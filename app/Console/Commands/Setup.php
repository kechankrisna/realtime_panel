<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class Setup extends Command
{
    protected $signature = 'app:setup';

    protected $description = 'Run the full application setup: generate key, migrate, link storage, clear cache, and create super admin';

    public function handle(): int
    {
        $this->info('► Generating application key...');
        $this->call('key:generate');

        $this->newLine();
        $this->info('► Running database migrations...');
        $this->call('migrate', ['--force' => true]);

        $this->newLine();
        $this->info('► Linking storage...');
        $this->call('storage:link');

        $this->newLine();
        $this->info('► Clearing cache...');
        $this->call('cache:clear');

        $this->newLine();
        $this->info('► Setting up super admin...');
        $exitCode = $this->call('app:setup-admin');

        if ($exitCode !== self::SUCCESS) {
            return $exitCode;
        }

        $this->newLine();
        $this->info('✔ Setup complete.');

        return self::SUCCESS;
    }
}
