<?php

namespace Tests\Feature\Chat;

use App\Models\Application;
use App\Models\User;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\TestCase;

class ChatTriggerTest extends TestCase
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

    public function test_owner_can_trigger_chat_message(): void
    {
        $this->mockPusher();

        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chat/trigger', [
                'application_id' => $app->id,
                'channel'        => 'chat-room-1',
                'data'           => [
                    'id'      => 'msg-1',
                    'sender'  => 'Alice',
                    'content' => 'Hello!',
                ],
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);
    }

    public function test_trigger_triggers_both_channel_and_monitor(): void
    {
        $pusher = $this->createMock(Pusher::class);
        $pusher->expects($this->exactly(2))->method('trigger');

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });

        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chat/trigger', [
                'application_id' => $app->id,
                'channel'        => 'chat-room-1',
                'data'           => ['id' => 'x', 'sender' => 'Bob', 'content' => 'Hi'],
            ]);
    }

    public function test_disabled_application_returns_404(): void
    {
        $user = User::factory()->create();
        $app  = Application::factory()->disabled()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chat/trigger', [
                'application_id' => $app->id,
                'channel'        => 'chat-room-1',
                'data'           => ['id' => 'x', 'sender' => 'Bob', 'content' => 'Hi'],
            ])
            ->assertNotFound();
    }

    public function test_non_owner_gets_404(): void
    {
        $user  = User::factory()->create();
        $other = User::factory()->create();
        $app   = Application::factory()->create(['created_by' => $other->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chat/trigger', [
                'application_id' => $app->id,
                'channel'        => 'chat-room-1',
                'data'           => ['id' => 'x', 'sender' => 'Bob', 'content' => 'Hi'],
            ])
            ->assertNotFound();
    }

    public function test_data_fields_are_required(): void
    {
        $user = User::factory()->create();
        $app  = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chat/trigger', [
                'application_id' => $app->id,
                'channel'        => 'chat-room-1',
                'data'           => [],
            ])
            ->assertUnprocessable();
    }

    public function test_unauthenticated_gets_401(): void
    {
        $this->postJson('/api/chat/trigger', [])->assertUnauthorized();
    }
}
