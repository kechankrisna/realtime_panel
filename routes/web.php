<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| SPA catch-all — all non-API requests serve the React app shell.
|
*/

Route::get('/{any}', fn () => view('app'))->where('any', '.*');
