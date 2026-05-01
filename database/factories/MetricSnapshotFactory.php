<?php

namespace Database\Factories;

use App\Models\Application;
use App\Models\MetricSnapshot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MetricSnapshot>
 */
class MetricSnapshotFactory extends Factory
{
    public function definition(): array
    {
        return [
            'application_id' => Application::factory(),
            'recorded_at' => now(),
            'connections' => fake()->numberBetween(0, 100),
        ];
    }
}
