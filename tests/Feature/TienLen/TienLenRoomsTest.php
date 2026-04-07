<?php

namespace Tests\Feature\TienLen;

use App\Models\Application;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class TienLenRoomsTest extends TestCase
{
    use RefreshDatabase;

    public function test_creator_can_open_tienlen_room(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms', [
                'application_id' => $app->id,
                'room_code' => 'TL001',
                'max_players' => 4,
            ])
            ->assertOk()
            ->assertJson(['ok' => true]);

        $room = Cache::get('tienlen_room_TL001');
        $this->assertEquals('waiting', $room['status']);
        $this->assertEquals(1, $room['seats']);
        $this->assertEquals(4, $room['max_players']);
    }

    public function test_player_can_join_and_seat_count_increments(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('tienlen_room_TL002', [
            'status' => 'waiting',
            'seats' => 1,
            'max_players' => 4,
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'TL002',
            ])
            ->assertOk();

        $this->assertEquals(2, $response->json('seats'));
        $this->assertEquals(4, $response->json('max_players'));
        $this->assertFalse($response->json('full'));
    }

    public function test_room_becomes_playing_when_fourth_seat_taken(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('tienlen_room_TL003', [
            'status' => 'waiting',
            'seats' => 3,
            'max_players' => 4,
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'TL003',
            ])
            ->assertOk();

        $this->assertTrue($response->json('full'));
        $this->assertEquals('playing', Cache::get('tienlen_room_TL003')['status']);
    }

    public function test_join_full_room_returns_409(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('tienlen_room_TL_FULL', [
            'status' => 'playing',
            'seats' => 4,
            'max_players' => 4,
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'TL_FULL',
            ])
            ->assertStatus(409);
    }

    public function test_join_nonexistent_room_returns_404(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'NOROOM',
            ])
            ->assertNotFound();
    }

    public function test_2player_room_fills_after_one_join(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('tienlen_room_TL2P', [
            'status' => 'waiting',
            'seats' => 1,
            'max_players' => 2,
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'TL2P',
            ])
            ->assertOk();

        $this->assertTrue($response->json('full'));
        $this->assertEquals(2, $response->json('seats'));
        $this->assertEquals(2, $response->json('max_players'));
        $this->assertEquals('playing', Cache::get('tienlen_room_TL2P')['status']);
    }

    public function test_3player_room_fills_after_two_joins(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        Cache::put('tienlen_room_TL3P', [
            'status' => 'waiting',
            'seats' => 2,
            'max_players' => 3,
            'application_id' => $app->id,
            'creator_id' => $user->id,
        ], now()->addMinutes(90));

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms/join', [
                'application_id' => $app->id,
                'room_code' => 'TL3P',
            ])
            ->assertOk();

        $this->assertTrue($response->json('full'));
        $this->assertEquals(3, $response->json('seats'));
        $this->assertEquals(3, $response->json('max_players'));
        $this->assertEquals('playing', Cache::get('tienlen_room_TL3P')['status']);
    }

    public function test_store_validates_max_players_range(): void
    {
        $user = User::factory()->create();
        $app = Application::factory()->create(['created_by' => $user->id, 'enabled' => true]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/tienlen/rooms', [
                'application_id' => $app->id,
                'room_code' => 'TL_VAL',
                'max_players' => 5,
            ])
            ->assertUnprocessable();
    }
}
