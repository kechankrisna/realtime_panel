<?php

namespace Tests\Feature\Chess;

use App\Models\Application;
use App\Models\User;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\TestCase;

class ChessTriggerTest extends TestCase
{
    use RefreshDatabase;

    private function mockPusher(): void
    {
        $pusher = $this->createMock(Pusher::class);
        $pusher->method('trigger')->willReturn((object) []);

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });
    }

    public function test_owner_can_trigger_chess_event(): void
    {
        $this->mockPusher();

        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/trigger', [
                'application_id' => $app->id,
                'room_code'      => 'ROOM01',
                'type'           => 'move',
                'payload'        => ['from' => 'e2', 'to' => 'e4'],
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_trigger_sends_event_to_both_channels(): void
    {
        $pusher = $this->createMock(Pusher::class);
        $pusher->expects($this->exactly(2))->method('trigger');

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });

        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/trigger', [
                'application_id' => $app->id,
                'room_code'      => 'ROOM01',
                'type'           => 'resign',
                'payload'        => ['reason' => 'test'],
            ]);
    }

    public function test_invalid_type_returns_422(): void
    {
        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/trigger', [
                'application_id' => $app->id,
                'room_code'      => 'ROOM01',
                'type'           => 'invalid-type',
                'payload'        => [],
            ])
            ->assertUnprocessable();
    }

    public function test_disabled_app_returns_404(): void
    {
        $user = User::factory()->create();
        $app  = Application::factory()->disabled()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/trigger', [
                'application_id' => $app->id,
                'room_code'      => 'ROOM01',
                'type'           => 'move',
                'payload'        => ['move' => 'e2-e4'],
            ])
            ->assertNotFound();
    }
}
