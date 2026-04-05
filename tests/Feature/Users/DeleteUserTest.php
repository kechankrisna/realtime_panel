<?php

namespace Tests\Feature\Users;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeleteUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_delete_other_user(): void
    {
        $admin  = User::factory()->admin()->create();
        $target = User::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/users/{$target->id}")
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
    }

    public function test_admin_cannot_delete_themselves(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/users/{$admin->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_non_admin_cannot_delete_user(): void
    {
        $user   = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/users/{$target->id}")
            ->assertForbidden();
    }

    public function test_nonexistent_user_returns_404(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->deleteJson('/api/users/99999')
            ->assertNotFound();
    }
}
