# RealtimePanel — Claude AI Instructions

This file is automatically loaded by Claude Code when working in this project. Read it fully before generating any code.

---

## What This Project Is

A **self-hosted WebSocket management dashboard** for [Soketi](https://soketi.app/) (Pusher-protocol-compatible WebSocket server). Key features:
- Manage Soketi "applications" (tenant isolation — each app has a `key`, `secret`, and connection limits)
- Monitor live WebSocket events via a `_monitor_{appId}` channel
- Configure HTTP webhooks stored as a JSON array in `applications.webhooks`
- Manage users (`is_admin` boolean, no RBAC library)
- Three built-in demos: Chat, Chess, Tien Lên card game

---

## Stack

| Layer | Technology |
|-------|-----------|
| PHP framework | Laravel 12 / PHP 8.3 |
| Auth | Laravel Sanctum — Bearer token, stored client-side in `localStorage` |
| WebSocket server | Soketi (Pusher protocol) — reads app config from MySQL, caches in Redis |
| Database | MySQL 8 |
| Cache / session | Redis 7 — DB 0 = Soketi cache, DB 1 = Laravel app cache |
| Frontend | React 19, pure SPA (NO Livewire, NO Alpine.js) |
| Routing | TanStack Router (`resources/js/router.jsx`) |
| Server state | TanStack Query v5 |
| UI components | shadcn/ui (Radix + Tailwind CSS 3) |
| WS client | Laravel Echo + pusher-js |
| Forms | react-hook-form + zod |
| Build | Vite 5 |
| Infrastructure | Docker Compose (5 services), Coolify (optional) |

---

## Absolute Rules

1. **Run `php artisan pint`** before committing any PHP file.
2. **Write a PHPUnit Feature test** for every new API endpoint.
3. **Never add `$fillable` or `$guarded`** — `Model::unguard()` is set globally in `AppServiceProvider::boot()`.
4. **Never touch** `vendor/`, `bootstrap/cache/`, `public/build/`.
5. **No Livewire, no Alpine.js** — Blade only provides `<div id="root">`.

---

## Backend: Ownership Enforcement

There are **two distinct patterns** depending on the endpoint type. Using the wrong one is a bug.

### Pattern A — CRUD resource controllers → returns 403
```php
// ApplicationController only
private function authorizeOwnership(Application $application): void
{
    if (auth()->user()->is_admin) return;
    if ($application->created_by !== auth()->id()) abort(403);
}
```

### Pattern B — Event/trigger controllers → returns 404
```php
// ChatController, ChessController, TienLenController
$app = Application::ownershipAware()
    ->where('enabled', true)
    ->findOrFail($validated['application_id']);
```

**Rule:** Use Pattern A for new CRUD controllers. Use Pattern B for any new event-trigger endpoint.

The base `Controller` class does **not** have an `authorizeOwnership` method — Pattern A is a private method scoped to `ApplicationController`.

---

## Backend: Every Trigger Endpoint Must Dual-Broadcast

```php
$pusher->trigger($channel, $eventName, $data);
$pusher->trigger('_monitor_' . $app->id, 'monitor.event', [
    'channel' => $channel,
    'event'   => $eventName,
    'data'    => $data,
]);
```

After any `PUT`/`PATCH` on an Application model:
```php
$application->clearCache(); // deletes soketi_app:{key} from Redis
```

---

## Backend: Migration Pattern

```php
Schema::create('table_name', function (Blueprint $table) {
    $table->id();
    // your columns
    $table->ownerships(); // adds created_by + updated_by (nullable FK + index)
    $table->timestamps();
});
```

`$table->ownerships()` is a Blueprint macro defined in `app/Mixins/BluePrintMixins.php`.

---

## Backend: Route Order

Custom and named routes **must** come before `apiResource()`:

```php
Route::get('/applications/stats', [ApplicationController::class, 'stats']);      // FIRST
Route::get('/applications/{application}/channels', [...]);                       // FIRST
Route::patch('/applications/{application}/toggle', [...]);                       // FIRST
Route::apiResource('/applications', ApplicationController::class);               // LAST
```

---

## Backend: `POST /applications` Intentional Asymmetry

`store()` **only** validates `name` + `enabled`. Limit fields (`max_connections`, rate limits, etc.) are set exclusively via `update()`. This is by design — do not add limit fields to `store()` validation.

---

## Backend: New Controller Checklist

1. Place in `app/Http/Controllers/Api/`
2. Register in `routes/api.php` inside `Route::middleware('auth:sanctum')->group(...)`
3. Custom routes before `apiResource()`
4. Apply the correct ownership pattern (A or B)
5. Return `response()->json(['ok' => true])` for operations, full model for CRUD
6. Call `$application->clearCache()` after any Application modification

---

## Frontend: API Client

```js
import api from '@/lib/axios'   // ← always this import path
```

File: `resources/js/lib/axios.js` (NOT `api.js`). Automatically attaches Bearer token from `localStorage` and redirects to `/login` on 401.

---

## Frontend: Adding a New Page

**1.** Create component in `resources/js/pages/<section>/`.

**2.** Add route in `router.jsx`:
```jsx
const myRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/my-path',
    component: MyPage,
    beforeLoad: requireAuth,   // always for protected routes
});
```

**3.** Add to `routeTree.addChildren([..., myRoute])`.

**4.** Access route params:
```jsx
const { id } = route.useParams();
```

---

## Frontend: Data Fetching Pattern

```jsx
// Read
const { data, isLoading } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => api.get(`/resource/${id}`).then(r => r.data),
});

// Write
const mutation = useMutation({
    mutationFn: (payload) => api.post('/resource', payload),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['resource'] });
        toast({ title: 'Saved!', variant: 'success' });
    },
    onError: (err) => {
        if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
    },
});
```

---

## Testing: New Endpoint Test Template

```php
<?php

namespace Tests\Feature\YourSection;

use App\Models\Application;
use App\Models\User;
use App\Services\PusherService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Pusher\Pusher;
use Tests\TestCase;

class YourEndpointTest extends TestCase
{
    use RefreshDatabase;

    private function mockPusher(): void
    {
        $pusher = $this->createMock(Pusher::class);
        $pusher->method('trigger')->willReturn((object) []);

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });
    }

    public function test_owner_can_use_endpoint(): void { /* ... */ }
    public function test_non_owner_gets_404(): void { /* ... */ }   // trigger endpoints
    public function test_non_owner_gets_403(): void { /* ... */ }   // resource controllers
    public function test_disabled_app_returns_404(): void { /* ... */ }
    public function test_unauthenticated_gets_401(): void { /* ... */ }
    public function test_validation_fails_with_missing_fields(): void { /* ... */ }
}
```

### Mocking the WebSocket cache (update/toggle tests)

```php
use Tests\Concerns\MocksWebSocketServer;

class MyTest extends TestCase
{
    use RefreshDatabase, MocksWebSocketServer;

    public function test_update_clears_cache(): void
    {
        $spy = $this->spyWebSocketServer();
        $user = User::factory()->create(['is_admin' => true]);
        $app  = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", ['name' => 'New', 'enabled' => true]);

        $this->assertCacheClearedFor($app, $spy);
    }
}
```

Available factory states: `Application::factory()->disabled()`, `User::factory()->inactive()`

---

## Commands

```bash
docker compose up -d          # start all services
php artisan pint               # code style (REQUIRED before commit)
php artisan test               # PHPUnit
php artisan migrate            # run migrations
php artisan optimize:clear     # clear all caches
npm run dev                    # Vite dev server
npm run build                  # production build
npm run test                   # Vitest
npx playwright test            # E2E
```

---

## Key Architecture Facts

- `resources/views/app.blade.php` is only the SPA shell (`<div id="root">`). All UI is React.
- Soketi reads app config from MySQL's `applications` table and caches it in Redis under `soketi_app:{key}` (DB 0). `clearCache()` deletes this key.
- The `_monitor_{appId}` channel receives a copy of every triggered event — used by the Monitor page to show a live event stream.
- `is_admin` boolean on `users` table — no RBAC package (spatie/permission is not installed).
- Default dev credentials: `admin@email.com` / `password`
