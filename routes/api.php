<?php

use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ChessController;
use App\Http\Controllers\Api\ConfigController;
use App\Http\Controllers\Api\EventTriggerController;
use App\Http\Controllers\Api\MetricsController;
use App\Http\Controllers\Api\MetricsHistoryController;
use App\Http\Controllers\Api\SoketiWebhookController;
use App\Http\Controllers\Api\TienLenController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public
Route::post('/auth/login', [AuthController::class, 'login']);
Route::post('/webhooks/soketi/{appId}', [SoketiWebhookController::class, 'receive']);

// Authenticated
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::put('/auth/user', [AuthController::class, 'updateProfile']);

    Route::get('/config', [ConfigController::class, 'index']);
    Route::get('/metrics', [MetricsController::class, 'index']);
    Route::get('/metrics/history', [MetricsHistoryController::class, 'index']);

    Route::get('/applications/stats', [ApplicationController::class, 'stats']);
    Route::get('/applications/{application}/channels', [ApplicationController::class, 'channels']);
    Route::patch('/applications/{application}/toggle', [ApplicationController::class, 'toggle']);
    Route::post('/applications/{application}/trigger', [EventTriggerController::class, 'trigger']);
    Route::apiResource('/applications', ApplicationController::class);

    Route::apiResource('/users', UserController::class);

    Route::post('/chat/trigger', [ChatController::class, 'trigger']);

    Route::post('/chess/rooms', [ChessController::class, 'store']);
    Route::post('/chess/rooms/join', [ChessController::class, 'join']);
    Route::post('/chess/trigger', [ChessController::class, 'trigger']);

    Route::post('/tienlen/rooms', [TienLenController::class, 'store']);
    Route::post('/tienlen/rooms/join', [TienLenController::class, 'join']);
    Route::post('/tienlen/trigger', [TienLenController::class, 'trigger']);
});
