<?php

namespace App\Console\Commands;

use App\Models\MetricSnapshot;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Console\Command\Command as ConsoleCommand;

class SnapshotMetricsCommand extends Command
{
    protected $signature = 'app:metrics-snapshot';

    protected $description = 'Snapshot Soketi connection metrics per application into the database';

    public function handle(): int
    {
        if (! config('metrics.enabled')) {
            return ConsoleCommand::SUCCESS;
        }

        $host = rtrim(config('metrics.host'), '/');

        try {
            $raw = Http::timeout(3)->get("{$host}/metrics")->body();
        } catch (\Throwable $e) {
            Log::warning('app:metrics-snapshot: could not reach metrics endpoint', ['error' => $e->getMessage()]);

            return ConsoleCommand::SUCCESS;
        }

        $entries = parse_prometheus('soketi_connected', $raw);

        if ($entries->isEmpty()) {
            return ConsoleCommand::SUCCESS;
        }

        $now = now();

        foreach ($entries as $entry) {
            $appId = (int) ($entry['json']['app_id'] ?? 0);

            if ($appId === 0) {
                continue;
            }

            MetricSnapshot::create([
                'application_id' => $appId,
                'recorded_at' => $now,
                'connections' => (int) $entry['value'],
            ]);
        }

        return ConsoleCommand::SUCCESS;
    }
}
