<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class MetricsController extends Controller
{
    public function index(): JsonResponse
    {
        if (! config('metrics.enabled')) {
            return response()->json(null);
        }

        $host = rtrim(config('metrics.host'), '/');

        try {
            $metricsRaw = Http::timeout(3)->get("{$host}/metrics")->body();
        } catch (\Throwable) {
            return response()->json(['error' => 'Metrics endpoint unavailable'], 503);
        }

        // Parse server started time — soketi prefixes its own metrics with 'soketi_'
        $startedAt = null;
        $startCollection = parse_prometheus('soketi_process_start_time_seconds', $metricsRaw);
        if ($startCollection->isNotEmpty()) {
            $startedAt = now()->subSeconds(now()->timestamp - (int) $startCollection->first()['value'])->diffForHumans();
        }

        // Parse memory usage
        $memoryPercent = null;
        $memoryTotal = null;
        $usedCollection = parse_prometheus('soketi_nodejs_heap_size_used_bytes', $metricsRaw);
        $totalCollection = parse_prometheus('soketi_nodejs_heap_size_total_bytes', $metricsRaw);
        if ($usedCollection->isNotEmpty() && $totalCollection->isNotEmpty()) {
            $used = (int) $usedCollection->first()['value'];
            $total = (int) $totalCollection->first()['value'];
            if ($total > 0) {
                $memoryPercent = round($used / $total * 100, 1);
                $memoryUsed = round($used / 1024 / 1024, 1).' MB';
                $memoryTotal = round($total / 1024 / 1024, 1).' MB';
            }
        }

        // Parse connections (ownership-aware)
        $user = auth()->user();
        $connectionsCollection = parse_prometheus('soketi_connected', $metricsRaw);

        if ($user->is_admin) {
            $totalConnections = $connectionsCollection->sum('value');
        } else {
            $appIds = Application::ownershipAware()->pluck('id')->map(fn ($id) => (string) $id);
            $totalConnections = $connectionsCollection
                ->filter(fn ($m) => $appIds->contains($m['json']['app_id'] ?? null))
                ->sum('value');
        }

        // CPU — rate-based percentage: delta(cpu_seconds) / delta(wall_time) * 100
        $cpuPercent = null;
        $cpuCollection = parse_prometheus('soketi_process_cpu_seconds_total', $metricsRaw);
        if ($cpuCollection->isNotEmpty()) {
            $currentCpu = (float) $cpuCollection->first()['value'];
            $now = microtime(true);
            $prev = cache('soketi_cpu_prev');
            if ($prev && isset($prev['cpu'], $prev['time'])) {
                $deltaCpu = $currentCpu - $prev['cpu'];
                $deltaTime = $now - $prev['time'];
                if ($deltaTime > 0) {
                    $cpuPercent = min(round($deltaCpu / $deltaTime * 100, 1), 100);
                }
            }
            cache(['soketi_cpu_prev' => ['cpu' => $currentCpu, 'time' => $now]], 60);
        }

        // RAM — Resident Set Size vs total system RAM
        $ramRss = null;
        $ramPercent = null;
        $ramTotalMb = null;
        $rssCollection = parse_prometheus('soketi_process_resident_memory_bytes', $metricsRaw);
        if ($rssCollection->isNotEmpty()) {
            $rssBytes = (int) $rssCollection->first()['value'];
            $ramRss = round($rssBytes / 1024 / 1024, 1).' MB';

            // Read total physical RAM from /proc/meminfo (available in Docker/Linux)
            if (is_readable('/proc/meminfo')) {
                $meminfo = file_get_contents('/proc/meminfo');
                if (preg_match('/^MemTotal:\s+(\d+)\s+kB/im', $meminfo, $m)) {
                    $totalBytes = (int) $m[1] * 1024;
                    $ramTotalMb = round($totalBytes / 1024 / 1024, 1);
                    $ramPercent = round($rssBytes / $totalBytes * 100, 1);
                }
            }
        }

        // Network — total bytes across all apps (WS + HTTP)
        $bytesHelper = function (string $metric) use ($metricsRaw): int {
            return (int) parse_prometheus($metric, $metricsRaw)->sum('value');
        };
        $netReceived = $bytesHelper('soketi_socket_received_bytes') + $bytesHelper('soketi_http_received_bytes');
        $netTransmitted = $bytesHelper('soketi_socket_transmitted_bytes') + $bytesHelper('soketi_http_transmitted_bytes');

        $formatBytes = function (int $bytes): string {
            if ($bytes >= 1073741824) {
                return round($bytes / 1073741824, 2).' GB';
            }
            if ($bytes >= 1048576) {
                return round($bytes / 1048576, 2).' MB';
            }
            if ($bytes >= 1024) {
                return round($bytes / 1024, 1).' KB';
            }

            return $bytes.' B';
        };

        // Disk usage — of the partition where the app lives
        $diskPercent = null;
        $diskUsed = null;
        $diskTotal = null;
        $diskPath = base_path();
        $diskFree = @disk_free_space($diskPath);
        $diskTotalRaw = @disk_total_space($diskPath);
        if ($diskFree !== false && $diskTotalRaw > 0) {
            $diskUsedRaw = $diskTotalRaw - $diskFree;
            $diskPercent = round($diskUsedRaw / $diskTotalRaw * 100, 1);
            $diskUsed = $formatBytes((int) $diskUsedRaw);
            $diskTotal = $formatBytes((int) $diskTotalRaw);
        }

        return response()->json([
            'started_at' => $startedAt ?? 'N/A',
            'memory_percent' => $memoryPercent,
            'memory_used' => $memoryUsed ?? null,
            'memory_total' => $memoryTotal ?? null,
            'total_connections' => (int) $totalConnections,
            'cpu_percent' => $cpuPercent,
            'ram_rss' => $ramRss,
            'ram_percent' => $ramPercent,
            'ram_total_mb' => $ramTotalMb,
            'net_received' => $formatBytes($netReceived),
            'net_transmitted' => $formatBytes($netTransmitted),
            'disk_percent' => $diskPercent,
            'disk_used' => $diskUsed,
            'disk_total' => $diskTotal,
        ]);
    }
}
