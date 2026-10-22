<?php

namespace App\Services\WebSocket;

use App\Contracts\WebSocketServerContract;
use App\Models\Application;
use Illuminate\Support\Facades\Redis;

class SoketiDriver implements WebSocketServerContract
{
    /**
     * Delete Soketi's cached copies of the given application on the "soketi" Redis connection.
     * Soketi caches an app twice: "app:{key}" (WebSocket connections look it up by key) and "app:{id}" (the HTTP API,
     * e.g. POST /apps/{id}/events, looks it up by id). After a key change the old "app:{key}" entry goes too, or the
     * old key keeps connecting until the cache TTL runs out.
     */
    public function clearAppCache(Application $app): void
    {
        $keys = ['app:'.$app->key, 'app:'.$app->id];

        $previousKey = $app->getPrevious()['key'] ?? null;
        if ($previousKey !== null && $previousKey !== $app->key) {
            $keys[] = 'app:'.$previousKey;
        }

        Redis::connection('soketi')->del(...$keys);
    }
}
