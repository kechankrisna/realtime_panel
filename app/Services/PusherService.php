<?php

namespace App\Services;

use Pusher\Pusher;

class PusherService
{
    /**
     * Create a configured Pusher instance for a given application.
     */
    public function make(string $key, string $secret, string|int $appId, array $options = []): Pusher
    {
        return new Pusher($key, $secret, $appId, $options);
    }
}
