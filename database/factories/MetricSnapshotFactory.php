<?php

namespace Database\Factories;

use App\Models\Application;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\MetricSnapshot>
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
