<?php

namespace Tests\Feature\Applications;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShowApplicationTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_view_own_application(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/applications/{$app->id}")
            ->assertOk()
            ->assertJsonPath('id', $app->id);
    }

    public function test_admin_can_view_any_application(): void
    {
        $admin = User::factory()->admin()->create();
        $other = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $other->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/applications/{$app->id}")
            ->assertOk();
    }

    public function test_non_owner_gets_403(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $other->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/applications/{$app->id}")
            ->assertForbidden();
    }

    public function test_nonexistent_application_returns_404(): void
    {
        $user = User::factory()->admin()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/applications/99999')
            ->assertNotFound();
    }
}
