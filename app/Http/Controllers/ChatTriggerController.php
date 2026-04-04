<?php

namespace App\Http\Controllers;

use App\Models\Application;
use Illuminate\Broadcasting\Broadcasters\PusherBroadcaster;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pusher\Pusher;

class ChatTriggerController extends Controller
{
    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'application_id' => ['required', 'integer'],
            'channel'        => ['required', 'string', 'max:100'],
            'data'           => ['required', 'array'],
            'data.id'        => ['required', 'string'],
            'data.sender'    => ['required', 'string', 'max:200'],
            'data.content'   => ['required', 'string', 'max:5000'],
        ]);

        // Enforce ownership — user can only trigger events for their own apps
        $app = Application::ownershipAware()
            ->where('enabled', true)
            ->findOrFail($validated['application_id']);

        $pusher = new Pusher(
            $app->key,
            $app->secret,
            $app->id,
            config('broadcasting.connections.pusher.options')
        );

        (new PusherBroadcaster($pusher))->broadcast(
            [$validated['channel']],
            'message',
            $validated['data']
        );

        return response()->json(['ok' => true]);
    }
}
