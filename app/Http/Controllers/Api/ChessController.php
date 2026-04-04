<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Pusher\Pusher;

class ChessController extends Controller
{
    /**
     * Creator registers an open room slot.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'room_code'      => ['required', 'string', 'max:10'],
        ]);

        Application::ownershipAware()
            ->where('enabled', true)
            ->findOrFail($validated['application_id']);

        Cache::put(
            'chess_room_' . $validated['room_code'],
            [
                'status'         => 'waiting',
                'application_id' => $validated['application_id'],
                'creator_id'     => Auth::id(),
            ],
            now()->addMinutes(90)
        );

        return response()->json(['ok' => true]);
    }

    /**
     * Joiner claims the open slot — enforces exactly one opponent.
     */
    public function join(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'room_code'      => ['required', 'string', 'max:10'],
        ]);

        $key  = 'chess_room_' . $validated['room_code'];
        $room = Cache::get($key);

        if (!$room) {
            return response()->json(['message' => 'Room not found.'], 404);
        }

        if ($room['status'] !== 'waiting') {
            return response()->json(['message' => 'Room is full or the game has already started.'], 409);
        }

        if ((int) $room['application_id'] !== (int) $validated['application_id']) {
            return response()->json(['message' => 'Wrong Soketi application for this room.'], 422);
        }

        Cache::put($key, array_merge($room, ['status' => 'playing']), now()->addMinutes(90));

        return response()->json(['ok' => true]);
    }

    /**
     * Broadcast a chess event (move, join, resign) to the room channel.
     */
    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'room_code'      => ['required', 'string', 'max:50'],
            'type'           => ['required', 'string', 'in:move,join,resign'],
            'payload'        => ['required', 'array'],
        ]);

        $app = Application::ownershipAware()
            ->where('enabled', true)
            ->findOrFail($validated['application_id']);

        $options = config('broadcasting.connections.pusher.options');

        $pusher = new Pusher(
            $app->key,
            $app->secret,
            $app->id,
            $options
        );

        $pusher->trigger(
            'chess-' . $validated['room_code'],
            'chess-event',
            array_merge(['type' => $validated['type']], $validated['payload'])
        );

        return response()->json(['ok' => true]);
    }
}
