<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="none,noarchive,nositelinkssearchbox" />
    <title>{{ config('app.name', 'Soketi Apps') }}</title>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body class="h-full bg-gray-50 antialiased">
    <div id="root" class="h-full"></div>
</body>
</html>
