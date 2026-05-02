<?php

namespace Tests\Feature\SoketiWebhook;

use App\Models\Application;
use App\Models\User;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\Concerns\MocksWebSocketServer;
use Tests\TestCase;

class SoketiWebhookTest extends TestCase
{
    use RefreshDatabase, MocksWebSocketServer;

    private function makePusherSpy(): Pusher
    {
        $pusher = \Mockery::spy(Pusher::class);

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });

        return $pusher;
    }

    private function sign(Application $app, array $payload): string
    {
        return hash_hmac('sha256', json_encode($payload), $app->secret);
    }

    private function postWebhook(Application $app, array $payload, ?string $signature = null)
    {
        $sig = $signature ?? $this->sign($app, $payload);

        return $this->withHeaders(['X-Pusher-Signature' => $sig])
            ->postJson("/api/webhooks/soketi/{$app->id}", $payload);
    }

    // -------------------------------------------------------------------------

    public function test_valid_channel_occupied_event_is_relayed(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();
        $payload = [
            'time_ms' => now()->timestamp * 1000,
            'events' => [['name' => 'channel_occupied', 'channel' => 'test-channel']],
        ];

        $this->postWebhook($app, $payload)->assertOk()->assertJson(['ok' => true]);

        $pusher->shouldHaveReceived('trigger')
            ->once()
            ->with('_monitor_'.$app->id, 'monitor.webhook', \Mockery::type('array'));
    }

    public function test_invalid_signature_returns_401(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();
        $payload = [
            'time_ms' => now()->timestamp * 1000,
            'events' => [['name' => 'channel_occupied', 'channel' => 'test-channel']],
        ];

        $this->postWebhook($app, $payload, 'bad-signature')->assertStatus(401);
    }

    public function test_missing_signature_returns_401(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postJson("/api/webhooks/soketi/{$app->id}", ['time_ms' => 0, 'events' => []])
            ->assertStatus(401);
    }

    public function test_unknown_app_returns_404(): void
    {
        $this->makePusherSpy();

        $this->withHeaders(['X-Pusher-Signature' => 'irrelevant'])
            ->postJson('/api/webhooks/soketi/99999', ['time_ms' => 0, 'events' => []])
            ->assertNotFound();
    }

    public function test_multiple_events_each_trigger_relay(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();
        $payload = [
            'time_ms' => now()->timestamp * 1000,
            'events' => [
                ['name' => 'channel_occupied', 'channel' => 'ch-1'],
                ['name' => 'channel_vacated',  'channel' => 'ch-2'],
                ['name' => 'member_added',      'channel' => 'presence-ch', 'user_id' => '42'],
            ],
        ];

        $this->postWebhook($app, $payload)->assertOk();

        $pusher->shouldHaveReceived('trigger')->times(3);
    }

    public function test_client_event_includes_inner_event_field(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();
        $payload = [
            'time_ms' => now()->timestamp * 1000,
            'events' => [[
                'name' => 'client_event',
                'channel' => 'private-room',
                'event' => 'client-my-event',
                'data' => '{"msg":"hello"}',
                'socket_id' => '123.456',
            ]],
        ];

        $this->postWebhook($app, $payload)->assertOk();

        $pusher->shouldHaveReceived('trigger')
            ->once()
            ->with(
                $this->anything(),
                'monitor.webhook',
                \Mockery::on(fn ($d) => $d['event'] === 'client-my-event')
            );
    }

    public function test_member_added_includes_socket_id(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();
        $payload = [
            'time_ms' => now()->timestamp * 1000,
            'events' => [[
                'name' => 'member_added',
                'channel' => 'presence-lobby',
                'user_id' => '7',
                'socket_id' => '99.88',
            ]],
        ];

        $this->postWebhook($app, $payload)->assertOk();

        $pusher->shouldHaveReceived('trigger')
            ->once()
            ->with(
                $this->anything(),
                'monitor.webhook',
                \Mockery::on(fn ($d) => $d['name'] === 'member_added' && $d['socket_id'] === '99.88')
            );
    }

    public function test_store_auto_injects_monitor_webhook(): void
    {
        $this->makePusherSpy();
        /** @var User $user */
        $user = User::factory()->create(['is_admin' => true]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/applications', ['name' => 'New App', 'enabled' => true])
            ->assertCreated();

        /** @var Application $app */
        $app = Application::find($response->json('id'));

        $this->assertTrue(
            collect($app->webhooks)->contains('url', url("/api/webhooks/soketi/{$app->id}"))
        );
    }

    public function test_update_auto_injects_monitor_webhook(): void
    {
        $this->makePusherSpy();
        $this->mockWebSocketServer();
        /** @var User $user */
        $user = User::factory()->create(['is_admin' => true]);
        /** @var Application $app */
        $app = Application::factory()->create(['created_by' => $user->id, 'webhooks' => []]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", ['name' => $app->name, 'enabled' => true])
            ->assertOk();

        $app->refresh();

        $this->assertTrue(
            collect($app->webhooks)->contains('url', url("/api/webhooks/soketi/{$app->id}"))
        );
    }

    public function test_inject_does_not_duplicate_webhook(): void
    {
        $this->makePusherSpy();
        /** @var Application $app */
        $app = Application::factory()->create(['webhooks' => []]);

        $app->injectMonitorWebhook();
        $app->refresh();
        $countAfterFirst = count($app->webhooks);

        $app->injectMonitorWebhook();
        $app->refresh();

        $this->assertSame($countAfterFirst, count($app->webhooks));
    }

    public function test_inject_webhooks_artisan_command(): void
    {
        $this->makePusherSpy();
        $this->mockWebSocketServer();
        Application::factory()->count(3)->create(['webhooks' => []]);

        $this->artisan('monitor:inject-webhooks')->assertSuccessful();

        Application::all()->each(function (Application $app) {
            $this->assertTrue(
                collect($app->webhooks)->contains('url', url("/api/webhooks/soketi/{$app->id}"))
            );
        });
    }
}
