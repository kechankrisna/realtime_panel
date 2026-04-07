<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class TienLenController extends Controller
{
    /**
     * Creator registers an open room (seat 1 of 4 claimed).
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'room_code' => ['required', 'string', 'max:10'],
            'max_players' => ['required', 'integer', 'in:2,3,4'],
        ]);

        Application::ownershipAware()
            ->where('enabled', true)
            ->findOrFail($validated['application_id']);

        Cache::put(
            'tienlen_room_'.$validated['room_code'],
            [
                'status' => 'waiting',
                'seats' => 1,
                'max_players' => $validated['max_players'],
                'application_id' => $validated['application_id'],
                'creator_id' => Auth::id(),
            ],
            now()->addMinutes(90)
        );

        return response()->json(['ok' => true]);
    }

    /**
     * Player claims one of the remaining open seats.
     */
    public function join(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'room_code' => ['required', 'string', 'max:10'],
        ]);

        $key = 'tienlen_room_'.$validated['room_code'];
        $room = Cache::get($key);

        if (! $room) {
            return response()->json(['message' => 'Room not found.'], 404);
        }

        if ($room['status'] !== 'waiting') {
            return response()->json(['message' => 'Room is full or the game has already started.'], 409);
        }

        if ((int) $room['application_id'] !== (int) $validated['application_id']) {
            return response()->json(['message' => 'Wrong Soketi application for this room.'], 422);
        }

        $maxPlayers = (int) ($room['max_players'] ?? 4);
        $newSeats = $room['seats'] + 1;
        $newStatus = $newSeats >= $maxPlayers ? 'playing' : 'waiting';

        Cache::put($key, array_merge($room, [
            'seats' => $newSeats,
            'status' => $newStatus,
        ]), now()->addMinutes(90));

        return response()->json(['ok' => true, 'seats' => $newSeats, 'max_players' => $maxPlayers, 'full' => $newSeats >= $maxPlayers]);
    }

    /**
     * Broadcast a Tien Len game event to all players in the room.
     */
    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'room_code' => ['required', 'string', 'max:50'],
            'type' => ['required', 'string', 'in:seat,deal,play,pass,win,chat'],
            'payload' => ['required', 'array'],
        ]);

        $app = Application::where('enabled', true)
            ->findOrFail($validated['application_id']);

        $options = config('broadcasting.connections.pusher.options');

        $pusher = app(PusherService::class)->make(
            $app->key,
            $app->secret,
            $app->id,
            $options
        );

        $payload = array_merge(['type' => $validated['type']], $validated['payload']);
        $channel = 'tienlen-'.$validated['room_code'];

        $pusher->trigger($channel, 'tienlen-event', $payload);

        // Relay to dedicated monitor channel.
        $pusher->trigger('_monitor_'.$app->id, 'monitor.event', [
            'channel' => $channel,
            'event' => 'tienlen-event',
            'data' => $payload,
        ]);

        return response()->json(['ok' => true]);
    }
}
