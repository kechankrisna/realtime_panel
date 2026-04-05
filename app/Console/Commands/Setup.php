<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class Setup extends Command
{
    protected $signature = 'app:setup';

    protected $description = 'Run the full application setup: generate key, migrate, link storage, clear cache, and create super admin';

    public function handle(): int
    {
        $this->info('► Clearing cache...');
        $this->call('optimize:clear');

        $this->newLine();
        $this->info('► Generating application key...');
        // Read .env file directly — config() may reflect a stale/cached value
        // if another process (e.g. start-server.sh) already wrote the key.
        $envContent = file_get_contents(base_path('.env'));
        if (! preg_match('/^APP_KEY=\S+/m', $envContent)) {
            $this->call('key:generate');
        } else {
            $this->line('  Application key already set, skipping.');
        }

        $this->newLine();
        $this->info('► Running database migrations...');
        $this->call('migrate', ['--force' => true]);

        $this->newLine();
        $this->info('► Linking storage...');
        $this->call('storage:link', ['--force' => true]);

        $this->newLine();
        $this->info('► Setting up super admin...');
        $exitCode = $this->call('app:setup-admin');

        if ($exitCode !== self::SUCCESS) {
            return $exitCode;
        }

        $this->newLine();
        $this->info('► Caching configuration...');
        $this->call('optimize');

        $this->newLine();
        $this->info('✔ Setup complete.');

        return self::SUCCESS;
    }
}
