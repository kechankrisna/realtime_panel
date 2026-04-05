<?php

namespace Tests\Concerns;

use App\Contracts\WebSocketServerContract;
use App\Models\Application;
use Mockery\MockInterface;

trait MocksWebSocketServer
{
    protected function mockWebSocketServer(): MockInterface
    {
        return $this->mock(WebSocketServerContract::class, function (MockInterface $mock) {
            $mock->shouldReceive('clearAppCache')->andReturn(null);
        });
    }

    protected function spyWebSocketServer(): MockInterface
    {
        return $this->spy(WebSocketServerContract::class);
    }

    protected function assertCacheClearedFor(Application $app, MockInterface $spy): void
    {
        $spy->shouldHaveReceived('clearAppCache')
            ->once()
            ->withArgs(fn (Application $a) => $a->id === $app->id);
    }
}
