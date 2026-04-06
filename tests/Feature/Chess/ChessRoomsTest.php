<?php

namespace Tests\Feature\Chess;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class ChessRoomsTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_chess_room(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/rooms', [
                'application_id' => $app->id,
                'room_code' => 'ROOM01',
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $room = Cache::get('chess_room_ROOM01');
        $this->assertEquals('waiting', $room['status']);
        $this->assertEquals($user->id, $room['creator_id']);
    }

    public function test_second_player_can_join_waiting_room(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('chess_room_ROOM02', [
            'status' => 'waiting',
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'ROOM02',
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $this->assertEquals('playing', Cache::get('chess_room_ROOM02')['status']);
    }

    public function test_join_full_room_returns_409(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('chess_room_FULL01', [
            'status' => 'playing',
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'FULL01',
            ])
            ->assertStatus(409);
    }

    public function test_join_nonexistent_room_returns_404(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'NOROOM',
            ])
            ->assertNotFound();
    }

    public function test_join_with_wrong_app_returns_422(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);
        $wrongId = 99999;

        Cache::put('chess_room_WRONG1', [
            'status' => 'waiting',
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/chess/rooms/join', [
                'application_id' => $wrongId,
                'room_code' => 'WRONG1',
            ])
            ->assertStatus(422);
    }
}
