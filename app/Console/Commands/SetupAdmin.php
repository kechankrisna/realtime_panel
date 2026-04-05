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

        // Fallback: re-read .env directly if env() returns null (e.g. after config cache was cleared mid-process)
        if (! $email || ! $password) {
            $envFile = base_path('.env');
            if (file_exists($envFile)) {
                $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                $vars  = [];
                foreach ($lines as $line) {
                    if (str_starts_with(trim($line), '#') || ! str_contains($line, '=')) {
                        continue;
                    }
                    [$key, $val] = explode('=', $line, 2);
                    $vars[trim($key)] = trim($val, " \t\n\r\0\x0B\"'");
                }
                $name     = $vars['SUPER_USER_NAME']  ?? $name;
                $email    = $vars['SUPER_USER_EMAIL']  ?? null;
                $password = $vars['SUPER_USER_PASSWORD'] ?? null;
            }
        }

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
