<?php

use App\Http\Controllers\Api\PusherProxyController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Pusher-compatible REST API proxy routes
|--------------------------------------------------------------------------
| These routes are registered WITHOUT the /api prefix so the Pusher PHP SDK
| can point directly at this app (host = nginx) instead of Soketi.
| All server-triggered events are intercepted here and dual-broadcast to the
| _monitor_{appId} channel so the Live Monitor page always receives them.
|
| External code change: host => 'soketi' / port => 6001
|                       ↓
|                       host => 'nginx'  / port => 80
*/

Route::post('/apps/{appId}/events', [PusherProxyController::class, 'trigger']);
