<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoketiWebhookController extends Controller
{
    public function receive(Request $request, int $appId): JsonResponse
    {
        $app = Application::findOrFail($appId);

        $signature = $request->header('X-Pusher-Signature', '');
        $expected = hash_hmac('sha256', $request->getContent(), $app->secret);

        if (! hash_equals($expected, $signature)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $events = $request->input('events', []);
        $options = config('broadcasting.connections.pusher.options');

        logger()->info("Received Soketi webhook for app {$app->id} with ".count($events).' event(s).', [
            'app_id' => $app->id,
            'events' => $events,
        ]);

        $pusher = app(PusherService::class)->make(
            $app->key,
            $app->secret,
            $app->id,
            $options
        );

        foreach ($events as $event) {
            try {
                $pusher->trigger('_monitor_'.$app->id, 'monitor.webhook', [
                    'name' => $event['name'] ?? null,
                    'channel' => $event['channel'] ?? null,
                    'event' => $event['event'] ?? null,
                    'data' => $event['data'] ?? null,
                    'socket_id' => $event['socket_id'] ?? null,
                ]);
            } catch (\Throwable $e) {
                logger()->error("Failed to relay webhook event to monitor channel for app {$app->id}: ".$e->getMessage());
            }
        }

        return response()->json(['ok' => true]);
    }
}
