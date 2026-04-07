<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

app()->booted(function () {
    app(Schedule::class)->command('cache:prune-stale-tags')->hourly();
    app(Schedule::class)->command('app:metrics-snapshot')->everyMinute()->withoutOverlapping();
});
