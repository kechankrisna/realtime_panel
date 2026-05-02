<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PusherProxyController extends Controller
{
    public function trigger(Request $request, int $appId): JsonResponse
    {
        $app = Application::where('id', $appId)
            ->where('enabled', true)
            ->firstOrFail();

        if (! $this->verifySignature($request, $app->key, $app->secret, $appId)) {
            return response()->json(['error' => 'Invalid signature'], 401);
        }

        $body = $request->json()->all();
        $channels = $body['channels'] ?? (isset($body['channel']) ? [$body['channel']] : []);
        $eventName = $body['name'] ?? null;
        $rawData = $body['data'] ?? null;

        if (empty($channels) || ! $eventName) {
            return response()->json(['error' => 'Missing channel/name'], 422);
        }

        $data = is_string($rawData) ? (json_decode($rawData, true) ?? $rawData) : ($rawData ?? new \stdClass);

        $options = config('broadcasting.connections.pusher.options');
        $pusher = app(PusherService::class)->make($app->key, $app->secret, $app->id, $options);

        foreach ($channels as $channel) {
            $pusher->trigger($channel, $eventName, $data);

            if ($channel !== '_monitor_'.$app->id) {
                $pusher->trigger('_monitor_'.$app->id, 'monitor.event', [
                    'channel' => $channel,
                    'event' => $eventName,
                    'data' => $data,
                ]);
            }
        }

        // Pusher REST API returns an empty object on success — must be {} not []
        return response()->json(new \stdClass);
    }

    private function verifySignature(Request $request, string $appKey, string $appSecret, int $appId): bool
    {
        $authKey = $request->query('auth_key', '');
        $authTimestamp = $request->query('auth_timestamp', '');
        $authVersion = $request->query('auth_version', '');
        $authSignature = $request->query('auth_signature', '');
        $bodyMd5 = $request->query('body_md5', '');

        if (! hash_equals($appKey, $authKey)) {
            return false;
        }

        if (! hash_equals(md5($request->getContent()), $bodyMd5)) {
            return false;
        }

        $params = [
            'auth_key' => $authKey,
            'auth_timestamp' => $authTimestamp,
            'auth_version' => $authVersion,
            'body_md5' => $bodyMd5,
        ];
        ksort($params);

        $stringToSign = implode("\n", [
            'POST',
            "/apps/{$appId}/events",
            http_build_query($params),
        ]);

        return hash_equals(hash_hmac('sha256', $stringToSign, $appSecret), $authSignature);
    }
}
