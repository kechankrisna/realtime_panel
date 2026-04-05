<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class UpdateAdmin extends Command
{
    protected $signature = 'app:update-admin';

    protected $description = 'Interactively update the super admin user\'s name, email, and password';

    public function handle(): int
    {
        $admin = User::where('is_admin', 1)
            ->when(env('SUPER_USER_EMAIL'), fn ($q) => $q->orderByRaw('email = ? DESC', [env('SUPER_USER_EMAIL')]))
            ->first();

        if (! $admin) {
            $this->error('No super admin found. Run app:setup-admin first.');

            return self::FAILURE;
        }

        $this->info("Updating super admin: {$admin->name} <{$admin->email}>");
        $this->line('Leave a field blank to keep the current value.');
        $this->newLine();

        $name = $this->ask("Name [{$admin->name}]");
        if ($name) {
            $admin->name = $name;
        }

        $email = $this->ask("Email [{$admin->email}]");
        if ($email) {
            $admin->email = $email;
        }

        $password = $this->secret('New password (blank to skip)');
        if ($password) {
            $confirm = $this->secret('Confirm new password');
            if ($password !== $confirm) {
                $this->error('Passwords do not match. No changes saved.');

                return self::FAILURE;
            }
            $admin->password = Hash::make($password);
        }

        $admin->save();

        $this->info("Super admin updated: {$admin->name} <{$admin->email}>");

        return self::SUCCESS;
    }
}
