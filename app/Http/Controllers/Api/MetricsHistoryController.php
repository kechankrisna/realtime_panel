<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MetricsHistoryController extends Controller
{
    private const VALID_PERIODS = ['live', 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'];

    public function index(Request $request): JsonResponse
    {
        $period = in_array($request->query('period'), self::VALID_PERIODS, true)
            ? $request->query('period')
            : 'live';

        $applicationId = $request->query('application_id');
        $tz = $this->resolveTimezone($request->query('timezone'));

        [$from, $to, $bucketExpr] = $this->resolvePeriod($period, $tz);

        $query = DB::table('metric_snapshots')
            ->selectRaw("{$bucketExpr} AS label, ROUND(AVG(connections)) AS connections")
            ->whereBetween('recorded_at', [$from, $to]);

        if ($applicationId !== null && $applicationId !== 'all') {
            // Pattern B — 404 on unauthorized or non-existent
            $app = Application::ownershipAware()->findOrFail((int) $applicationId);
            $query->where('application_id', $app->id);
        } else {
            $user = auth()->user();
            if ($user->is_admin) {
                // Admin sees all apps — no additional filter needed
            } else {
                $ownedIds = Application::ownershipAware()->pluck('id');
                $query->whereIn('application_id', $ownedIds);
            }
        }

        $data = $query
            ->groupByRaw($bucketExpr)
            ->orderByRaw($bucketExpr)
            ->get()
            ->map(fn ($row) => [
                'label' => $row->label,
                'connections' => (int) $row->connections,
            ]);

        return response()->json([
            'period' => $period,
            'application_id' => ($applicationId !== null && $applicationId !== 'all') ? (int) $applicationId : null,
            'data' => $data,
        ]);
    }

    private function resolveTimezone(?string $tz): string
    {
        if ($tz === null || $tz === '') {
            return 'UTC';
        }

        try {
            new \DateTimeZone($tz);

            return $tz;
        } catch (\Exception) {
            return 'UTC';
        }
    }

    private function resolvePeriod(string $period, string $tz): array
    {
        $isSqlite = DB::getDriverName() === 'sqlite';

        if ($isSqlite) {
            return match ($period) {
                'live' => [
                    now()->subHour(),
                    now(),
                    "strftime('%H:%M', recorded_at)",
                ],
                'today' => [
                    today(),
                    now(),
                    "strftime('%Y-%m-%d %H:', recorded_at) || printf('%02d', (cast(strftime('%M', recorded_at) as integer) / 15) * 15)",
                ],
                'yesterday' => [
                    today()->subDay(),
                    today(),
                    "strftime('%Y-%m-%d %H:', recorded_at) || printf('%02d', (cast(strftime('%M', recorded_at) as integer) / 30) * 30)",
                ],
                'this_week', 'last_week' => $period === 'this_week'
                    ? [today()->startOfWeek(), now(), "strftime('%w %H:00', recorded_at)"]
                    : [today()->subWeek()->startOfWeek(), today()->subWeek()->endOfWeek(), "strftime('%w %H:00', recorded_at)"],
                'this_month' => [today()->startOfMonth(), now(), "strftime('%Y-%m-%d', recorded_at)"],
                'last_month' => [today()->subMonth()->startOfMonth(), today()->subMonth()->endOfMonth(), "strftime('%Y-%m-%d', recorded_at)"],
            };
        }

        $nowUtc = now($tz)->utc();
        $todayInTz = today($tz);
        $quotedTz = DB::connection()->getPdo()->quote($tz);
        $col = "CONVERT_TZ(recorded_at, 'UTC', {$quotedTz})";

        return match ($period) {
            'live' => [
                $nowUtc->copy()->subHour(),
                $nowUtc,
                "DATE_FORMAT({$col}, '%H:%i')",
            ],
            'today' => [
                $todayInTz->copy()->utc(),
                $nowUtc,
                "CONCAT(DATE_FORMAT({$col}, '%H:'), LPAD(FLOOR(MINUTE({$col})/15)*15, 2, '0'))",
            ],
            'yesterday' => [
                $todayInTz->copy()->subDay()->utc(),
                $todayInTz->copy()->utc(),
                "CONCAT(DATE_FORMAT({$col}, '%H:'), LPAD(FLOOR(MINUTE({$col})/30)*30, 2, '0'))",
            ],
            'this_week' => [
                $todayInTz->copy()->startOfWeek()->utc(),
                $nowUtc,
                "DATE_FORMAT({$col}, '%a %H:00')",
            ],
            'last_week' => [
                $todayInTz->copy()->subWeek()->startOfWeek()->utc(),
                $todayInTz->copy()->subWeek()->endOfWeek()->utc(),
                "DATE_FORMAT({$col}, '%a %H:00')",
            ],
            'this_month' => [
                $todayInTz->copy()->startOfMonth()->utc(),
                $nowUtc,
                "DATE({$col})",
            ],
            'last_month' => [
                $todayInTz->copy()->subMonth()->startOfMonth()->utc(),
                $todayInTz->copy()->subMonth()->endOfMonth()->utc(),
                "DATE({$col})",
            ],
        };
    }
}
