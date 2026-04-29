<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventTriggerController extends Controller
{
    public function trigger(Request $request, Application $application): JsonResponse
    {
        $app = Application::ownershipAware()
            ->where('enabled', true)
            ->findOrFail($application->id);

        $validated = $request->validate([
            'channel' => ['required', 'string', 'max:200'],
            'event'   => ['required', 'string', 'max:200', 'not_regex:/^pusher/i'],
            'data'    => ['nullable', 'string', 'json'],
        ], [
            'event.not_regex' => 'Event name cannot start with "pusher" — that prefix is reserved by the Pusher protocol.',
        ]);

        $data = isset($validated['data']) ? json_decode($validated['data'], true) : new \stdClass();

        $options = config('broadcasting.connections.pusher.options');

        $pusher = app(PusherService::class)->make(
            $app->key,
            $app->secret,
            $app->id,
            $options
        );

        $pusher->trigger($validated['channel'], $validated['event'], $data);

        // Only relay through the monitor channel when the target is a different channel.
        // If the user triggered directly on _monitor_{id}, the monitor page already
        // receives the frame as a subscriber — a second relay would duplicate it.
        if ($validated['channel'] !== '_monitor_'.$app->id) {
            $pusher->trigger('_monitor_'.$app->id, 'monitor.event', [
                'channel' => $validated['channel'],
                'event'   => $validated['event'],
                'data'    => $data,
            ]);
        }

        return response()->json(['ok' => true]);
    }
}
