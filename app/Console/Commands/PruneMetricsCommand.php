<?php

namespace App\Console\Commands;

use App\Models\MetricSnapshot;
use Illuminate\Console\Command;
use Symfony\Component\Console\Command\Command as ConsoleCommand;

class PruneMetricsCommand extends Command
{
    protected $signature = 'app:metrics-prune {--days=60 : Number of days of history to retain}';

    protected $description = 'Delete metric snapshots older than the specified number of days';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));

        $deleted = MetricSnapshot::where('recorded_at', '<', now()->subDays($days))->delete();

        $this->info("Pruned {$deleted} snapshot(s) older than {$days} day(s).");

        return ConsoleCommand::SUCCESS;
    }
}
