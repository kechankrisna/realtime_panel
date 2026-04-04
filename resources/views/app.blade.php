<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="none,noarchive,nositelinkssearchbox" />
    <meta name="app-version" content="{{ config('app.version', '1.0.0') }}" />
    <title>{{ config('app.name', 'Soketi Apps') }}</title>
    {{-- Prevent flash of unstyled content: apply dark class before first paint --}}
    <script>
        (function () {
            var t = localStorage.getItem('soketi-theme');
            var dark = t === 'dark' || !t || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            if (dark) document.documentElement.classList.add('dark');
        })();
    </script>
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body class="h-full bg-background text-foreground antialiased">
    <div id="root" class="h-full"></div>
</body>
</html>
