<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123')]);

        $response = $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'secret123',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'is_admin', 'is_active']]);
    }

    public function test_login_returns_422_for_wrong_password(): void
    {
        $user = User::factory()->create(['password' => bcrypt('secret123')]);

        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    public function test_login_returns_422_for_unknown_email(): void
    {
        $this->postJson('/api/auth/login', [
            'email'    => 'nobody@example.com',
            'password' => 'password',
        ])->assertUnprocessable();
    }

    public function test_inactive_user_cannot_login(): void
    {
        $user = User::factory()->inactive()->create(['password' => bcrypt('secret123')]);

        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'secret123',
        ])->assertUnprocessable();
    }

    public function test_login_requires_email_and_password(): void
    {
        $this->postJson('/api/auth/login', [])->assertUnprocessable();
    }

    public function test_unauthenticated_request_returns_401(): void
    {
        $this->getJson('/api/auth/user')->assertUnauthorized();
    }
}
