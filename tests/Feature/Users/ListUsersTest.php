<?php

namespace Tests\Feature\Users;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListUsersTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_list_users(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory(3)->create();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonStructure(['data', 'total']);
    }

    public function test_non_admin_gets_403(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/users')
            ->assertForbidden();
    }

    public function test_unauthenticated_gets_401(): void
    {
        $this->getJson('/api/users')->assertUnauthorized();
    }

    public function test_admin_can_search_users(): void
    {
        $admin = User::factory()->admin()->create();
        User::factory()->create(['name' => 'Alice Smith']);
        User::factory()->create(['name' => 'Bob Jones']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users?search=Alice')
            ->assertOk()
            ->assertJsonPath('total', 1);
    }
}
