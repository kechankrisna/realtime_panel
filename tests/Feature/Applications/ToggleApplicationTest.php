<?php

namespace Tests\Feature\Applications;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MocksWebSocketServer;
use Tests\TestCase;

class ToggleApplicationTest extends TestCase
{
    use MocksWebSocketServer, RefreshDatabase;

    public function test_owner_can_toggle_application(): void
    {
        $this->mockWebSocketServer();

        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/applications/{$app->id}/toggle")
            ->assertOk()
            ->assertJson(['enabled' => false]);

        $this->assertDatabaseHas('applications', ['id' => $app->id, 'enabled' => false]);
    }

    public function test_toggle_clears_cache(): void
    {
        $spy = $this->spyWebSocketServer();
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/applications/{$app->id}/toggle");

        $this->assertCacheClearedFor($app, $spy);
    }

    public function test_toggle_flips_enabled_to_true(): void
    {
        $this->mockWebSocketServer();

        $user = User::factory()->create();
        $app = Application::factory()->disabled()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/applications/{$app->id}/toggle")
            ->assertOk()
            ->assertJson(['enabled' => true]);
    }

    public function test_non_owner_gets_403(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $other->id]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/applications/{$app->id}/toggle")
            ->assertForbidden();
    }
}
