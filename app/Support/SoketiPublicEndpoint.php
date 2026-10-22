<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Where clients reach Soketi (config/soketi.php). Without SOKETI_PUBLIC_HOST it is derived from APP_URL: the panel's
 * own host, which the bundled nginx forwards to Soketi.
 */
final class SoketiPublicEndpoint
{
    private function __construct(
        public readonly string $host,
        public readonly int $port,
        public readonly string $scheme,
        public readonly bool $configured,
    ) {}

    public static function fromConfig(): self
    {
        $appUrl = parse_url((string) config('app.url')) ?: [];
        $appScheme = in_array($appUrl['scheme'] ?? null, ['http', 'https'], true) ? $appUrl['scheme'] : 'http';

        $host = trim((string) config('soketi.public.host'));
        $configured = $host !== '';

        $scheme = self::scheme(config('soketi.public.scheme'), $appScheme);
        $defaultPort = $scheme === 'https' ? 443 : 80;
        // another host never inherits the panel URL's port
        $fallbackPort = $configured ? $defaultPort : (int) ($appUrl['port'] ?? $defaultPort);

        return new self(
            host: $configured ? $host : ($appUrl['host'] ?? 'localhost'),
            port: self::port(config('soketi.public.port'), $fallbackPort),
            scheme: $scheme,
            configured: $configured,
        );
    }

    /** @return array{host: string, port: int, scheme: string, configured: bool} */
    public function toArray(): array
    {
        return [
            'host' => $this->host,
            'port' => $this->port,
            'scheme' => $this->scheme,
            'configured' => $this->configured,
        ];
    }

    private static function scheme(mixed $value, string $fallback): string
    {
        if ($value === null || $value === '') {
            return $fallback;
        }

        $scheme = strtolower(trim((string) $value));
        if (in_array($scheme, ['http', 'https'], true)) {
            return $scheme;
        }

        Log::warning("SOKETI_PUBLIC_SCHEME must be http or https, got '{$value}': using {$fallback}");

        return $fallback;
    }

    private static function port(mixed $value, int $fallback): int
    {
        if ($value === null || $value === '') {
            return $fallback;
        }

        $port = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]]);
        if ($port !== false) {
            return $port;
        }

        Log::warning("SOKETI_PUBLIC_PORT must be a port number (1-65535), got '{$value}': using {$fallback}");

        return $fallback;
    }
}
