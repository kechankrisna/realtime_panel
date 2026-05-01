<?php

namespace Database\Factories;

use App\Models\Application;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Application>
 */
class ApplicationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->words(2, true),
            'key' => Str::random(20),
            'secret' => Str::random(40),
            'max_connections' => -1,
            'enable_client_messages' => false,
            'enabled' => true,
            'max_backend_events_per_sec' => -1,
            'max_client_events_per_sec' => -1,
            'max_read_req_per_sec' => -1,
            'webhooks' => [],
            'max_presence_members_per_channel' => 100,
            'max_presence_member_size_in_kb' => 10,
            'max_channel_name_length' => 100,
            'max_event_channels_at_once' => 100,
            'max_event_name_length' => 100,
            'max_event_payload_in_kb' => 100,
            'max_event_batch_size' => 10,
            'enable_user_authentication' => false,
        ];
    }

    public function disabled(): static
    {
        return $this->state(['enabled' => false]);
    }
}
