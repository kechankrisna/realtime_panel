<?php

namespace Tests\Feature\PublicEventTrigger;

use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\TestCase;

class PublicEventTriggerTest extends TestCase
{
    use RefreshDatabase;

    private function makePusherSpy(): Pusher
    {
        $pusher = \Mockery::spy(Pusher::class);

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });

        return $pusher;
    }

    private function payload(Application $app, array $overrides = []): array
    {
        return array_merge([
            'key' => $app->key,
            'secret' => $app->secret,
            'channel' => 'my-channel',
            'event' => 'test-event',
            'data' => json_encode(['msg' => 'hello']),
        ], $overrides);
    }

    // -------------------------------------------------------------------------

    public function test_valid_credentials_trigger_event_and_relay_to_monitor(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postJson('/api/events/trigger', $this->payload($app))
            ->assertOk()
            ->assertJson(['ok' => true]);

        $pusher->shouldHaveReceived('trigger')
            ->with('my-channel', 'test-event', \Mockery::type('array'))
            ->once();

        $pusher->shouldHaveReceived('trigger')
            ->with('_monitor_'.$app->id, 'monitor.event', \Mockery::type('array'))
            ->once();
    }

    public function test_wrong_secret_returns_401(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postJson('/api/events/trigger', $this->payload($app, ['secret' => 'wrong-secret']))
            ->assertUnauthorized();
    }

    public function test_unknown_key_returns_404(): void
    {
        $this->makePusherSpy();

        $this->postJson('/api/events/trigger', [
            'key' => 'nonexistent-key',
            'secret' => 'any-secret',
            'channel' => 'ch',
            'event' => 'ev',
        ])->assertNotFound();
    }

    public function test_disabled_app_returns_404(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->disabled()->create();

        $this->postJson('/api/events/trigger', $this->payload($app))
            ->assertNotFound();
    }

    public function test_pusher_prefixed_event_returns_422(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postJson('/api/events/trigger', $this->payload($app, ['event' => 'pusher:connection_established']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['event']);
    }

    public function test_missing_required_fields_returns_422(): void
    {
        $this->makePusherSpy();

        $this->postJson('/api/events/trigger', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['key', 'secret', 'channel', 'event']);
    }

    public function test_monitor_channel_target_does_not_double_relay(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postJson('/api/events/trigger', $this->payload($app, [
            'channel' => '_monitor_'.$app->id,
        ]))->assertOk();

        // Only one trigger call — no relay when targeting the monitor channel directly
        $pusher->shouldHaveReceived('trigger')->once();
    }

    public function test_null_data_sends_empty_object(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postJson('/api/events/trigger', $this->payload($app, ['data' => null]))
            ->assertOk();

        $pusher->shouldHaveReceived('trigger')
            ->with('my-channel', 'test-event', \Mockery::on(fn ($d) => $d instanceof \stdClass))
            ->once();
    }
}
