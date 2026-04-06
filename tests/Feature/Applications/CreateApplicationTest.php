<?php

namespace Tests\Feature\Applications;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CreateApplicationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_create_application(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/applications', [
                'name' => 'My App',
                'enabled' => true,
            ]);

        $response->assertCreated()
            ->assertJsonStructure(['id', 'key', 'secret', 'name', 'enabled']);

        $this->assertDatabaseHas('applications', [
            'name' => 'My App',
            'created_by' => $user->id,
        ]);
    }

    public function test_key_and_secret_are_auto_generated(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/applications', [
                'name' => 'Auto Keys',
                'enabled' => true,
            ]);

        $data = $response->assertCreated()->json();
        $this->assertNotEmpty($data['key']);
        $this->assertNotEmpty($data['secret']);
    }

    public function test_name_must_be_unique(): void
    {
        $user = User::factory()->create();

        \App\Models\Application::factory()->create([
            'name' => 'Duplicate',
            'created_by' => $user->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/applications', [
                'name' => 'Duplicate',
                'enabled' => true,
            ])
            ->assertUnprocessable();
    }

    public function test_name_is_required(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/applications', ['enabled' => true])
            ->assertUnprocessable();
    }

    public function test_unauthenticated_cannot_create(): void
    {
        $this->postJson('/api/applications', [
            'name' => 'Test',
            'enabled' => true,
        ])->assertUnauthorized();
    }
}
