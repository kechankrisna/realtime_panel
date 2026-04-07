<?php

namespace Tests\Feature\Metrics;

use App\Models\Application;
use App\Models\MetricSnapshot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MetricsHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_unauthenticated_gets_401(): void
    {
        $this->getJson('/api/metrics/history')
            ->assertUnauthorized();
    }

    public function test_authenticated_user_can_view_all_apps_history(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/metrics/history')
            ->assertOk()
            ->assertJsonStructure(['period', 'application_id', 'data']);
    }

    public function test_returns_empty_array_when_no_snapshots(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/metrics/history?period=live')
            ->assertOk()
            ->assertJsonPath('data', []);
    }

    public function test_live_period_excludes_old_snapshots(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id]);

        // Snapshot within the last hour — should appear
        MetricSnapshot::create([
            'application_id' => $app->id,
            'recorded_at' => now()->subMinutes(30),
            'connections' => 5,
        ]);

        // Snapshot older than one hour — should NOT appear
        MetricSnapshot::create([
            'application_id' => $app->id,
            'recorded_at' => now()->subHours(2),
            'connections' => 99,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/metrics/history?period=live')
            ->assertOk();

        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals(5, $data[0]['connections']);
    }

    public function test_invalid_period_defaults_to_live(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/metrics/history?period=invalid_value')
            ->assertOk();

        $this->assertEquals('live', $response->json('period'));
    }

    public function test_owner_can_filter_by_their_own_app(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id]);

        MetricSnapshot::create([
            'application_id' => $app->id,
            'recorded_at' => now()->subMinutes(5),
            'connections' => 10,
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/metrics/history?period=live&application_id={$app->id}")
            ->assertOk();

        $this->assertEquals($app->id, $response->json('application_id'));
        $this->assertNotEmpty($response->json('data'));
    }

    public function test_non_owner_gets_404_for_another_users_app(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $other->id]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/metrics/history?period=live&application_id={$app->id}")
            ->assertNotFound();
    }

    public function test_admin_can_filter_by_any_app(): void
    {
        $admin = User::factory()->admin()->create();
        $other = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $other->id]);

        MetricSnapshot::create([
            'application_id' => $app->id,
            'recorded_at' => now()->subMinutes(5),
            'connections' => 7,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/metrics/history?period=live&application_id={$app->id}")
            ->assertOk()
            ->assertJsonPath('application_id', $app->id);
    }

    public function test_non_admin_all_apps_only_sees_own_apps(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $ownApp = Application::factory()->create(['created_by' => $user->id]);
        $otherApp = Application::factory()->create(['created_by' => $other->id]);

        MetricSnapshot::create([
            'application_id' => $ownApp->id,
            'recorded_at' => now()->subMinutes(5),
            'connections' => 3,
        ]);
        MetricSnapshot::create([
            'application_id' => $otherApp->id,
            'recorded_at' => now()->subMinutes(5),
            'connections' => 50,
        ]);

        // The aggregate "all apps" view should only show connections=3 (own app)
        // and not include connections=50 (other user's app)
        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/metrics/history?period=live')
            ->assertOk();

        $total = collect($response->json('data'))->sum('connections');
        $this->assertEquals(3, $total);
    }
}
