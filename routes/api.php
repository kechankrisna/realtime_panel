<?php

use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ChatController;
use App\Http\Controllers\Api\ConfigController;
use App\Http\Controllers\Api\MetricsController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Public
Route::post('/auth/login', [AuthController::class, 'login']);

// Authenticated
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/user', [AuthController::class, 'user']);
    Route::put('/auth/user', [AuthController::class, 'updateProfile']);

    Route::get('/config', [ConfigController::class, 'index']);
    Route::get('/metrics', [MetricsController::class, 'index']);

    Route::get('/applications/stats', [ApplicationController::class, 'stats']);
    Route::patch('/applications/{application}/toggle', [ApplicationController::class, 'toggle']);
    Route::apiResource('/applications', ApplicationController::class);

    Route::apiResource('/users', UserController::class);

    Route::post('/chat/trigger', [ChatController::class, 'trigger']);
});
