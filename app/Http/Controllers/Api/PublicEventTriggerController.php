<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicEventTriggerController extends Controller
{
    public function trigger(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => ['required', 'string'],
            'secret' => ['required', 'string'],
            'channel' => ['required', 'string', 'max:200'],
            'event' => ['required', 'string', 'max:200', 'not_regex:/^pusher/i'],
            'data' => ['nullable', 'string', 'json'],
        ], [
            'event.not_regex' => 'Event name cannot start with "pusher" — that prefix is reserved by the Pusher protocol.',
        ]);

        $app = Application::where('key', $validated['key'])
            ->where('enabled', true)
            ->firstOrFail();

        if (! hash_equals($app->secret, $validated['secret'])) {
            abort(401, 'Invalid secret.');
        }

        $data = isset($validated['data']) ? json_decode($validated['data'], true) : new \stdClass;

        $options = config('broadcasting.connections.pusher.options');

        $pusher = app(PusherService::class)->make(
            $app->key,
            $app->secret,
            $app->id,
            $options
        );

        $pusher->trigger($validated['channel'], $validated['event'], $data);

        if ($validated['channel'] !== '_monitor_'.$app->id) {
            $pusher->trigger('_monitor_'.$app->id, 'monitor.event', [
                'channel' => $validated['channel'],
                'event' => $validated['event'],
                'data' => $data,
            ]);
        }

        return response()->json(['ok' => true]);
    }
}
