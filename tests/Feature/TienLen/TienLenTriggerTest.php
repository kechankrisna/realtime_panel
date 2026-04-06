<?php

namespace Tests\Feature\TienLen;

use App\Models\Application;
use App\Models\User;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\TestCase;

class TienLenTriggerTest extends TestCase
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

    public function test_owner_can_trigger_tienlen_event(): void
    {
        $this->mockPusher();

        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/trigger', [
                'application_id' => $app->id,
                'room_code' => 'TL001',
                'type' => 'play',
                'payload' => ['cards' => ['3H', '4D']],
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_trigger_sends_to_both_channels(): void
    {
        $pusher = $this->createMock(Pusher::class);
        $pusher->expects($this->exactly(2))->method('trigger');

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });

        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/trigger', [
                'application_id' => $app->id,
                'room_code' => 'TL001',
                'type' => 'deal',
                'payload' => ['round' => 1],
            ]);
    }

    public function test_invalid_type_returns_422(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/trigger', [
                'application_id' => $app->id,
                'room_code' => 'TL001',
                'type' => 'bad-type',
                'payload' => [],
            ])
            ->assertUnprocessable();
    }

    public function test_non_owner_gets_404(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $other->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/trigger', [
                'application_id' => $app->id,
                'room_code' => 'TL001',
                'type' => 'seat',
                'payload' => ['seat' => 1],
            ])
            ->assertNotFound();
    }
}
