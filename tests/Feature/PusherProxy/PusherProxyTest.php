<?php

namespace Tests\Feature\PusherProxy;

use App\Models\Application;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\TestCase;

class PusherProxyTest extends TestCase
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

    private function signedRequest(Application $app, array $body): array
    {
        $appId = $app->id;
        $path = "/apps/{$appId}/events";
        $bodyJson = json_encode($body);
        $bodyMd5 = md5($bodyJson);

        $params = [
            'auth_key' => $app->key,
            'auth_timestamp' => (string) time(),
            'auth_version' => '1.0',
            'body_md5' => $bodyMd5,
        ];
        ksort($params);

        $stringToSign = implode("\n", ['POST', $path, http_build_query($params)]);
        $params['auth_signature'] = hash_hmac('sha256', $stringToSign, $app->secret);

        return ['path' => $path, 'query' => $params, 'body' => $bodyJson];
    }

    private function postEvent(Application $app, array $body, array $queryOverrides = [])
    {
        $req = $this->signedRequest($app, $body);
        $query = array_merge($req['query'], $queryOverrides);

        return $this->call(
            'POST',
            $req['path'].'?'.http_build_query($query),
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            $req['body']
        );
    }

    // -------------------------------------------------------------------------

    public function test_valid_request_triggers_event_and_relays_to_monitor(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postEvent($app, [
            'channel' => 'private-stores.1.sales',
            'name' => 'test-event',
            'data' => json_encode(['message' => 'hello']),
        ])->assertOk()->assertExactJson([]);

        $pusher->shouldHaveReceived('trigger')
            ->with('private-stores.1.sales', 'test-event', \Mockery::type('array'))
            ->once();

        $pusher->shouldHaveReceived('trigger')
            ->with('_monitor_'.$app->id, 'monitor.event', \Mockery::type('array'))
            ->once();
    }

    public function test_multiple_channels_each_trigger_and_relay(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postEvent($app, [
            'channels' => ['ch-one', 'ch-two'],
            'name' => 'broadcast',
            'data' => json_encode(['x' => 1]),
        ])->assertOk();

        // 2 real triggers + 2 monitor relays = 4 total calls
        $pusher->shouldHaveReceived('trigger')->times(4);
    }

    public function test_invalid_signature_returns_401(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postEvent($app, [
            'channel' => 'ch',
            'name' => 'ev',
            'data' => '{}',
        ], ['auth_signature' => 'tampered'])->assertUnauthorized();
    }

    public function test_wrong_app_key_returns_401(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postEvent($app, [
            'channel' => 'ch',
            'name' => 'ev',
            'data' => '{}',
        ], ['auth_key' => 'wrong-key'])->assertUnauthorized();
    }

    public function test_tampered_body_returns_401(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        // body_md5 in the signature was computed for the original body
        $req = $this->signedRequest($app, ['channel' => 'ch', 'name' => 'ev', 'data' => '{}']);

        $this->call(
            'POST',
            $req['path'].'?'.http_build_query($req['query']),
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['channel' => 'ch', 'name' => 'ev', 'data' => '{"tampered":true}']) // different body
        )->assertUnauthorized();
    }

    public function test_unknown_app_returns_404(): void
    {
        $this->makePusherSpy();

        $this->postJson('/apps/99999/events?auth_key=x&auth_timestamp=1&auth_version=1.0&body_md5=x&auth_signature=x', [])
            ->assertNotFound();
    }

    public function test_disabled_app_returns_404(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->disabled()->create();

        $this->postEvent($app, [
            'channel' => 'ch',
            'name' => 'ev',
            'data' => '{}',
        ])->assertNotFound();
    }

    public function test_monitor_channel_target_does_not_double_relay(): void
    {
        $pusher = $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postEvent($app, [
            'channel' => '_monitor_'.$app->id,
            'name' => 'test-event',
            'data' => '{}',
        ])->assertOk();

        $pusher->shouldHaveReceived('trigger')->once();
    }

    public function test_missing_channel_and_name_returns_422(): void
    {
        $this->makePusherSpy();
        $app = Application::factory()->create();

        $this->postEvent($app, ['data' => '{}'])
            ->assertUnprocessable();
    }
}
