<?php

namespace Tests\Feature\Commands;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SetupCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_setup_command_runs_successfully(): void
    {
        $this->artisan('app:setup')
            ->assertSuccessful();
    }

    public function test_setup_creates_admin_user(): void
    {
        $this->artisan('app:setup')
            ->assertSuccessful();

        $this->assertDatabaseHas('users', [
            'email' => 'admin@test.com',
            'is_admin' => 1,
        ]);
    }

    public function test_setup_outputs_completion_message(): void
    {
        $this->artisan('app:setup')
            ->expectsOutputToContain('Setup complete')
            ->assertSuccessful();
    }

    public function test_setup_calls_setup_admin_as_last_step(): void
    {
        // Verify the user is created (proving app:setup-admin was called)
        $this->assertDatabaseMissing('users', ['email' => 'admin@test.com']);

        $this->artisan('app:setup')->assertSuccessful();

        $this->assertDatabaseHas('users', ['email' => 'admin@test.com']);
    }
}
