<?php

namespace Tests\Feature\Config;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class ConfigTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_get_config(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/config')
            ->assertOk()
            ->assertJsonStructure([
                'app_name', 'app_version', 'app_url', 'app_host', 'app_port',
                'soketi_public' => ['host', 'port', 'scheme', 'configured'],
            ]);
    }

    public function test_unauthenticated_gets_401(): void
    {
        $this->getJson('/api/config')->assertUnauthorized();
    }

    public function test_soketi_public_defaults_to_the_panel_url_when_not_configured(): void
    {
        $this->setSoketiPublic(appUrl: 'https://panel.example.com');

        $this->assertSoketiPublic([
            'host' => 'panel.example.com', 'port' => 443, 'scheme' => 'https', 'configured' => false,
        ]);
    }

    public function test_soketi_public_keeps_an_explicit_port_of_the_panel_url(): void
    {
        $this->setSoketiPublic(appUrl: 'http://localhost:8080');

        $this->assertSoketiPublic([
            'host' => 'localhost', 'port' => 8080, 'scheme' => 'http', 'configured' => false,
        ]);
    }

    public function test_soketi_public_uses_the_configured_host_port_and_scheme(): void
    {
        $this->setSoketiPublic(appUrl: 'https://panel.example.com', host: 'pusher.example.com', port: '6002', scheme: 'http');

        $this->assertSoketiPublic([
            'host' => 'pusher.example.com', 'port' => 6002, 'scheme' => 'http', 'configured' => true,
        ]);
    }

    /** Another host never inherits the panel URL's port: it gets its scheme's default. */
    public function test_a_configured_host_without_port_gets_the_default_port_of_its_scheme(): void
    {
        $this->setSoketiPublic(appUrl: 'https://panel.example.com:8443', host: 'pusher.example.com');

        $this->assertSoketiPublic([
            'host' => 'pusher.example.com', 'port' => 443, 'scheme' => 'https', 'configured' => true,
        ]);
    }

    public function test_invalid_scheme_and_port_fall_back_to_the_defaults_with_a_warning(): void
    {
        Log::spy();
        $this->setSoketiPublic(appUrl: 'https://panel.example.com', host: 'pusher.example.com', port: '70000', scheme: 'wss');

        $this->assertSoketiPublic([
            'host' => 'pusher.example.com', 'port' => 443, 'scheme' => 'https', 'configured' => true,
        ]);
        Log::shouldHaveReceived('warning')->twice();
    }

    private function setSoketiPublic(string $appUrl, ?string $host = null, ?string $port = null, ?string $scheme = null): void
    {
        config([
            'app.url' => $appUrl,
            'soketi.public.host' => $host,
            'soketi.public.port' => $port,
            'soketi.public.scheme' => $scheme,
        ]);
    }

    /** Strict: the port must be an int, not "443". */
    private function assertSoketiPublic(array $expected): void
    {
        $actual = $this->actingAs(User::factory()->create(), 'sanctum')
            ->getJson('/api/config')
            ->assertOk()
            ->json('soketi_public');

        ksort($expected);
        ksort($actual);
        $this->assertSame($expected, $actual);
    }
}
