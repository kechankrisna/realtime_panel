<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Public Soketi endpoint
    |--------------------------------------------------------------------------
    |
    | Where browsers and client apps reach Soketi, when that is not the panel's
    | own host (e.g. panel on realtime-panel.example.com, Soketi on
    | pusher.example.com). The panel's live pages (Live Monitor, Chat, the
    | galleries) connect there, and the Documentation pages show it.
    |
    | Leave SOKETI_PUBLIC_HOST empty when the panel's nginx forwards /app/* to
    | Soketi on the same host (the bundled Docker setup): the browser then uses
    | the page's own host, as before. Unset port/scheme: the scheme of APP_URL,
    | and 443 (https) or 80 (http).
    |
    | This is only what clients see. The panel's own server-side calls to Soketi
    | use PUSHER_HOST / PUSHER_PORT / PUSHER_SCHEME (config/broadcasting.php).
    |
    */

    'public' => [
        'host' => env('SOKETI_PUBLIC_HOST'),
        'port' => env('SOKETI_PUBLIC_PORT'),
        'scheme' => env('SOKETI_PUBLIC_SCHEME'),
    ],

];
