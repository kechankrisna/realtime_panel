<?php

namespace Tests\Unit\Services;

use App\Models\Application;
use App\Services\WebSocket\SoketiDriver;
use Illuminate\Support\Facades\Redis;
use Mockery;
use Tests\TestCase;

class SoketiDriverTest extends TestCase
{
    /**
     * Soketi caches an app twice: "app:{key}" (WebSocket connections look it up by key) and "app:{id}" (the HTTP API,
     * e.g. POST /apps/{id}/events, looks it up by id). Both must go, or a disabled app keeps publishing until the TTL.
     */
    public function test_clears_the_key_and_the_id_cache_entries(): void
    {
        $app = new Application(['key' => 'test-key']);
        $app->id = 7;
        $app->syncOriginal();

        $connection = Mockery::mock();
        $connection->shouldReceive('del')->once()->with('app:test-key', 'app:7');
        Redis::shouldReceive('connection')->once()->with('soketi')->andReturn($connection);

        (new SoketiDriver)->clearAppCache($app);
    }

    /**
     * A changed key must also drop the old key's entry, or the old key keeps connecting until the TTL. The cache is
     * cleared after update() returns, so the old key is only in getPrevious().
     */
    public function test_also_clears_the_previous_key_after_a_key_change(): void
    {
        $app = new Application;
        $app->setRawAttributes(['id' => 7, 'key' => 'old-key'], true);
        $app->key = 'new-key';
        // what Model::save() does after the UPDATE query
        $app->syncChanges();
        $app->syncOriginal();

        $connection = Mockery::mock();
        $connection->shouldReceive('del')->once()->with('app:new-key', 'app:7', 'app:old-key');
        Redis::shouldReceive('connection')->once()->with('soketi')->andReturn($connection);

        (new SoketiDriver)->clearAppCache($app);
    }
}
