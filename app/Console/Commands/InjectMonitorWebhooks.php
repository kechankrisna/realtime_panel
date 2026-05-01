<?php

namespace App\Console\Commands;

use App\Models\Application;
use Illuminate\Console\Command;

class InjectMonitorWebhooks extends Command
{
    protected $signature = 'monitor:inject-webhooks';

    protected $description = 'Inject the Soketi monitor webhook URL into all applications';

    public function handle(): int
    {
        $apps = Application::all();
        $bar = $this->output->createProgressBar($apps->count());
        $bar->start();

        foreach ($apps as $app) {
            $app->injectMonitorWebhook();
            $app->clearCache();
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Injected monitor webhook into {$apps->count()} application(s).");

        return Command::SUCCESS;
    }
}
