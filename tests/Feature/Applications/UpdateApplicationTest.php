<?php

namespace Tests\Feature\Applications;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\MocksWebSocketServer;
use Tests\TestCase;

class UpdateApplicationTest extends TestCase
{
    use RefreshDatabase, MocksWebSocketServer;

    public function test_owner_can_update_application(): void
    {
        $this->mockWebSocketServer();

        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", [
                'name' => 'Updated Name',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Updated Name');
    }

    public function test_update_clears_cache(): void
    {
        $spy  = $this->spyWebSocketServer();
        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", ['name' => 'Changed']);

        $this->assertCacheClearedFor($app, $spy);
    }

    public function test_admin_can_reassign_ownership(): void
    {
        $this->mockWebSocketServer();

        $admin = User::factory()->admin()->create();
        $other = User::factory()->create();
        $app   = Application::factory()->create(['created_by' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/applications/{$app->id}", [
                'name'       => $app->name,
                'created_by' => $other->id,
            ])
            ->assertOk();

        $this->assertDatabaseHas('applications', [
            'id'         => $app->id,
            'created_by' => $other->id,
        ]);
    }

    public function test_non_admin_cannot_reassign_ownership(): void
    {
        $this->mockWebSocketServer();

        $user  = User::factory()->create();
        $other = User::factory()->create();
        $app   = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", [
                'name'       => $app->name,
                'created_by' => $other->id,
            ])
            ->assertOk();

        // created_by should not have changed
        $this->assertDatabaseHas('applications', [
            'id'         => $app->id,
            'created_by' => $user->id,
        ]);
    }

    public function test_non_owner_gets_403(): void
    {
        $user  = User::factory()->create();
        $other = User::factory()->create();
        $app   = Application::factory()->create(['created_by' => $other->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", ['name' => 'Hack'])
            ->assertForbidden();
    }

    public function test_name_must_be_unique_except_self(): void
    {
        $this->mockWebSocketServer();

        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id]);

        // Updating with its own name should succeed
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", ['name' => $app->name])
            ->assertOk();
    }
}
