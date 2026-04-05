<?php

namespace App\Services\WebSocket;

use App\Contracts\WebSocketServerContract;
use App\Models\Application;
use Illuminate\Support\Facades\Redis;

class SoketiDriver implements WebSocketServerContract
{
    /**
     * Delete the Soketi Redis cache key for the given application.
     * Soketi stores app config under "app:{key}" on the "soketi" Redis connection.
     */
    public function clearAppCache(Application $app): void
    {
        Redis::connection('soketi')->del('app:'.$app->key);
    }
}
