<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class SetupAdmin extends Command
{
    protected $signature = 'app:setup-admin';

    protected $description = 'Create or update the super admin user from environment variables';

    public function handle(): int
    {
        $name     = env('SUPER_USER_NAME', 'Super Admin');
        $email    = env('SUPER_USER_EMAIL');
        $password = env('SUPER_USER_PASSWORD');

        if (! $email || ! $password) {
            $this->error('SUPER_USER_EMAIL and SUPER_USER_PASSWORD must be set in your .env file.');

            return self::FAILURE;
        }

        User::updateOrCreate(
            ['email' => $email],
            [
                'name'              => $name,
                'password'          => Hash::make($password),
                'is_admin'          => 1,
                'is_active'         => 1,
                'email_verified_at' => now(),
            ]
        );

        $this->info("Super admin ready: {$name} <{$email}>");

        return self::SUCCESS;
    }
}
