<?php

namespace Tests\Feature\Applications;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListApplicationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sees_all_applications(): void
    {
        $admin = User::factory()->admin()->create();
        $other = User::factory()->create();

        Application::factory()->create(['created_by' => $admin->id]);
        Application::factory()->create(['created_by' => $other->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/applications')
            ->assertOk()
            ->assertJsonPath('total', 2);
    }

    public function test_non_admin_sees_only_own_applications(): void
    {
        $admin = User::factory()->admin()->create();
        $user  = User::factory()->create();

        Application::factory()->create(['created_by' => $admin->id]);
        Application::factory(2)->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/applications')
            ->assertOk()
            ->assertJsonPath('total', 2);
    }

    public function test_filter_by_active(): void
    {
        $admin = User::factory()->admin()->create();
        Application::factory()->create(['created_by' => $admin->id, 'enabled' => true]);
        Application::factory()->disabled()->create(['created_by' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/applications?filter=active')
            ->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_filter_by_inactive(): void
    {
        $admin = User::factory()->admin()->create();
        Application::factory()->create(['created_by' => $admin->id, 'enabled' => true]);
        Application::factory()->disabled()->create(['created_by' => $admin->id]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/applications?filter=inactive')
            ->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_search_by_name(): void
    {
        $admin = User::factory()->admin()->create();
        Application::factory()->create(['created_by' => $admin->id, 'name' => 'my-unique-app']);
        Application::factory()->create(['created_by' => $admin->id, 'name' => 'other-app']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/applications?search=my-unique')
            ->assertOk()
            ->assertJsonPath('total', 1);
    }

    public function test_unauthenticated_returns_401(): void
    {
        $this->getJson('/api/applications')->assertUnauthorized();
    }
}
