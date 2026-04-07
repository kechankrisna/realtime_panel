<?php

namespace App\Console\Commands;

use App\Models\Application;
use App\Models\MetricSnapshot;
use Illuminate\Console\Command;
use Symfony\Component\Console\Command\Command as ConsoleCommand;

class ClearMetricsCommand extends Command
{
    protected $signature = 'app:metrics-clear
                            {--app= : Application ID to clear (omit to clear all apps)}
                            {--force : Skip confirmation prompt}';

    protected $description = 'Delete metric snapshot history (all apps or a single app)';

    public function handle(): int
    {
        $appId = $this->option('app');

        if ($appId !== null) {
            $appId = (int) $appId;

            try {
                $application = Application::findOrFail($appId);
            } catch (\Throwable) {
                $this->error("Application with ID {$appId} not found.");

                return ConsoleCommand::FAILURE;
            }

            if (! $this->option('force') && ! $this->confirm("Clear all metric history for application \"{$application->name}\" (ID {$appId})?")) {
                $this->info('Aborted.');

                return ConsoleCommand::SUCCESS;
            }

            $deleted = MetricSnapshot::where('application_id', $appId)->delete();
            $this->info("Cleared {$deleted} snapshot(s) for application \"{$application->name}\".");

            return ConsoleCommand::SUCCESS;
        }

        if (! $this->option('force') && ! $this->confirm('Clear ALL metric history for all applications? This cannot be undone.')) {
            $this->info('Aborted.');

            return ConsoleCommand::SUCCESS;
        }

        MetricSnapshot::truncate();
        $this->info('All metric history cleared.');

        return ConsoleCommand::SUCCESS;
    }
}
