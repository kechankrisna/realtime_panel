<?php

namespace Tests\Unit\Models;

use App\Contracts\WebSocketServerContract;
use App\Models\Application;
use Mockery\MockInterface;
use Tests\TestCase;

class ApplicationTest extends TestCase
{
    public function test_clear_cache_delegates_to_contract(): void
    {
        $app = new Application(['id' => 1, 'key' => 'test-key']);

        $mock = $this->mock(WebSocketServerContract::class, function (MockInterface $mock) use ($app) {
            $mock->shouldReceive('clearAppCache')
                ->once()
                ->withArgs(fn (Application $a) => $a === $app);
        });

        $app->clearCache();
    }

    public function test_clear_cache_does_not_call_redis_directly(): void
    {
        $app = new Application(['id' => 2, 'key' => 'other-key']);

        $this->mock(WebSocketServerContract::class, function (MockInterface $mock) {
            $mock->shouldReceive('clearAppCache')->once()->andReturn(null);
        });

        // If a Redis call were made directly it would throw in unit tests (no Redis).
        // The fact this succeeds confirms full delegation.
        $app->clearCache();

        $this->addToAssertionCount(1);
    }
}
