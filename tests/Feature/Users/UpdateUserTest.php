<?php

namespace Tests\Feature\Users;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_update_user(): void
    {
        $admin = User::factory()->admin()->create();
        $target = User::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/users/{$target->id}", [
                'name' => 'Updated',
                'email' => 'updated@example.com',
            ])
            ->assertOk()
            ->assertJsonPath('name', 'Updated');
    }

    public function test_non_admin_cannot_update_other_user(): void
    {
        $user = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/users/{$target->id}", [
                'name' => 'Hack',
                'email' => $target->email,
            ])
            ->assertForbidden();
    }

    public function test_admin_can_update_password(): void
    {
        $admin = User::factory()->admin()->create();
        $target = User::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/users/{$target->id}", [
                'name' => $target->name,
                'email' => $target->email,
                'password' => 'new-password-456',
            ])
            ->assertOk();
    }

    public function test_admin_cannot_change_own_active_status(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/users/{$admin->id}", [
                'name' => $admin->name,
                'email' => $admin->email,
                'is_active' => false,
            ])
            ->assertOk();

        // is_active should be unchanged
        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
    }
}
