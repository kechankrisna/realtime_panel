<?php

namespace Tests\Feature\Config;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
            ->assertJsonStructure(['app_name', 'app_version', 'app_url', 'app_host', 'app_port']);
    }

    public function test_unauthenticated_gets_401(): void
    {
        $this->getJson('/api/config')->assertUnauthorized();
    }
}
