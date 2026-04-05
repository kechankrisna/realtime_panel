<?php

namespace App\Contracts;

use App\Models\Application;

interface WebSocketServerContract
{
    /**
     * Invalidate the cached application config on the WebSocket server.
     * Called after any application update, toggle, or delete.
     */
    public function clearAppCache(Application $app): void;
}
