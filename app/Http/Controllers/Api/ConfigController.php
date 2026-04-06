<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class ConfigController extends Controller
{
    public function index(): JsonResponse
    {
        $url = config('app.url');
        $parsed = parse_url($url);

        return response()->json([
            'app_name' => config('app.name'),
            'app_version' => config('app.version'),
            'app_url' => $url,
            'app_host' => $parsed['host'] ?? 'localhost',
            'app_port' => env('APP_PORT', 6001),
        ]);
    }
}
