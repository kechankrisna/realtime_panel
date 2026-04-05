<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_get_own_profile(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/user')
            ->assertOk()
            ->assertJson([
                'id'    => $user->id,
                'email' => $user->email,
            ]);
    }

    public function test_user_can_update_name_and_email(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/auth/user', [
                'name'  => 'New Name',
                'email' => 'new@example.com',
            ])
            ->assertOk()
            ->assertJson(['name' => 'New Name', 'email' => 'new@example.com']);
    }

    public function test_user_can_update_password(): void
    {
        $user = User::factory()->create(['password' => bcrypt('old-pass')]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/auth/user', [
                'name'     => $user->name,
                'email'    => $user->email,
                'password' => 'new-password-123',
            ])
            ->assertOk();

        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'new-password-123',
        ])->assertOk();
    }

    public function test_email_must_be_unique_on_update(): void
    {
        $other = User::factory()->create(['email' => 'taken@example.com']);
        $user  = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/auth/user', [
                'name'  => $user->name,
                'email' => 'taken@example.com',
            ])
            ->assertUnprocessable();
    }

    public function test_unauthenticated_user_cannot_update_profile(): void
    {
        $this->putJson('/api/auth/user', ['name' => 'x', 'email' => 'x@x.com'])
            ->assertUnauthorized();
    }
}
