<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'channel' => ['required', 'string', 'max:100'],
            'data' => ['required', 'array'],
            'data.id' => ['required', 'string'],
            'data.sender' => ['required', 'string', 'max:200'],
            'data.content' => ['required', 'string', 'max:5000'],
        ]);

        $app = Application::ownershipAware()
            ->where('enabled', true)
            ->findOrFail($validated['application_id']);

        $options = config('broadcasting.connections.pusher.options');

        $pusher = app(PusherService::class)->make(
            $app->key,
            $app->secret,
            $app->id,
            $options
        );

        $pusher->trigger($validated['channel'], 'message', $validated['data']);

        $pusher->trigger('_monitor_'.$app->id, 'monitor.event', [
            'channel' => $validated['channel'],
            'event' => 'message',
            'data' => $validated['data'],
        ]);

        return response()->json(['ok' => true]);
    }
}
