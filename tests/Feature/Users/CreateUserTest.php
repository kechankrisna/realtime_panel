<?php

namespace Tests\Feature\Users;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateUserTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_user(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'New User',
                'email' => 'newuser@example.com',
                'password' => 'password123',
                'is_active' => true,
                'is_admin' => false,
            ])
            ->assertCreated()
            ->assertJsonStructure(['id', 'name', 'email']);

        $this->assertDatabaseHas('users', ['email' => 'newuser@example.com']);
    }

    public function test_non_admin_cannot_create_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'Hacker',
                'email' => 'hack@example.com',
                'password' => 'password123',
            ])
            ->assertForbidden();
    }

    public function test_email_must_be_unique(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->create(['email' => 'taken@example.com']);

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'Duplicate',
                'email' => 'taken@example.com',
                'password' => 'password123',
            ])
            ->assertUnprocessable();
    }

    public function test_password_is_required_on_create(): void
    {
        $admin = User::factory()->admin()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/users', [
                'name' => 'No Pass',
                'email' => 'nopass@example.com',
            ])
            ->assertUnprocessable();
    }
}
