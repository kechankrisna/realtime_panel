<?php

namespace App\Providers;

use App\Mixins\BluePrintMixins;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if ($this->app->environment('production') && str_starts_with(config('app.url'), 'https://')) {
            $this->app['request']->server->set('HTTPS', 'on');
        }

        Model::unguard();

        Blueprint::mixin(new BluePrintMixins);
    }
}
