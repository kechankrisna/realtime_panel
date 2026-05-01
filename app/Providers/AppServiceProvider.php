<?php

namespace App\Providers;

use App\Contracts\WebSocketServerContract;
use App\Mixins\BluePrintMixins;
use App\Services\PusherService;
use App\Services\WebSocket\SoketiDriver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(WebSocketServerContract::class, SoketiDriver::class);
        $this->app->bind(PusherService::class, PusherService::class);
    }

    public function boot(): void
    {
        if ($this->app->environment('production') && str_starts_with(config('app.url'), 'https://')) {
            $this->app['request']->server->set('HTTPS', 'on');
        }

        Model::unguard();

        Blueprint::mixin(new BluePrintMixins);

        RateLimiter::for('api', function (Request $request) {
            return $request->user()
                ? Limit::perMinute(300)->by($request->user()->id)
                : Limit::perMinute(60)->by($request->ip());
        });
    }
}
