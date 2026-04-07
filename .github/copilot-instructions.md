# RealtimePanel — GitHub Copilot Instructions

## Project Overview

**RealtimePanel** is a self-hosted WebSocket management dashboard for [Soketi](https://soketi.app/) (Pusher-protocol-compatible). It lets operators manage Soketi "applications", monitor live events, configure webhooks, manage users, and includes three built-in gallery demos (Chat, Chess, Tien Lên card game).

---

## Tech Stack

### Backend
- **PHP 8.3 / Laravel 12** — framework
- **Laravel Sanctum** — Bearer token API authentication (tokens in `localStorage` client-side)
- **Pusher PHP SDK** — triggers events to Soketi
- **MySQL 8** — primary database
- **Redis 7** — DB 0 for Soketi app cache, DB 1 for Laravel app cache (game rooms, CPU delta)
- **Soketi** — WebSocket server (Pusher protocol), reads app config from MySQL, caches in Redis

### Frontend
- **React 19** — UI framework (pure SPA — **no Livewire, no Alpine.js**)
- **TanStack Router** — client-side routing (`resources/js/router.jsx`)
- **TanStack Query v5** — all server state (`useQuery`, `useMutation`, `useQueryClient`)
- **shadcn/ui** — component library (built on Radix UI + Tailwind CSS 3)
- **Laravel Echo + pusher-js** — WebSocket client
- **react-hook-form + zod** — form handling and validation
- **Vite 5** — build tool

### Infrastructure
- **Docker Compose** — 5 services: `realtime-panel` (PHP-FPM), `realtime-panel-nginx`, `realtime-panel-mysql`, `realtime-panel-redis`, `realtime-websocket-server` (Soketi)
- **Nginx** — proxies `/app/*` and `/apps/*` paths to Soketi as WebSocket upgrades
- **Coolify** — optional PaaS deployment (`docker-compose.coolify.yml`)

---

## Project Structure

### Backend
```
app/
  Http/Controllers/Api/       # All API controllers (ApplicationController, AuthController, ChatController, etc.)
  Models/                     # Application.php, User.php
  Traits/HasOwnership.php     # scopeOwnershipAware(), creator(), updater() relations
  Contracts/WebSocketServerContract.php
  Services/
    PusherService.php         # Factory: creates Pusher instances on demand
    WebSocket/SoketiDriver.php # Deletes soketi_app:{key} from Redis on app config change
  Providers/AppServiceProvider.php
  Mixins/BluePrintMixins.php  # ownerships() Blueprint macro
routes/api.php
database/migrations/
```

### Frontend
```
resources/js/
  app.jsx                     # React root: StrictMode → QueryClientProvider → RouterProvider
  router.jsx                  # All TanStack Router route definitions
  lib/axios.js                # Axios API client — import as: import api from '@/lib/axios'
  lib/echo.js                 # createEcho(app) factory for Laravel Echo instances
  hooks/                      # useAuth, useTheme, useToast
  pages/                      # One folder per route (auth/, applications/, users/, galleries/, etc.)
  components/
    ui/                       # shadcn/ui components
    layout/                   # AppLayout, Sidebar, Header
    widgets/                  # Dashboard widgets (ServerStats, SystemStats, ApplicationStats)
```

---

## Non-Negotiable Rules

1. **Always run `php artisan pint`** before committing any PHP code.
2. **Always write a PHPUnit Feature test** for every new API endpoint.
3. **Never modify** `vendor/`, `bootstrap/cache/`, or `public/build/`.
4. **No `$fillable` or `$guarded`** on models — `Model::unguard()` is set globally in `AppServiceProvider::boot()`.
5. **No Livewire, no Alpine.js** — the frontend is a pure React SPA.

---

## Backend Conventions

### Mass Assignment
`Model::unguard()` is global. Do **not** add `$fillable` or `$guarded` arrays to any model.

### Ownership Pattern — TWO variants (choose carefully)
**Option A — Resource controllers** (returns 403 on violation):
```php
// Used in ApplicationController only
private function authorizeOwnership(Application $application): void
{
    if (auth()->user()->is_admin) return;
    if ($application->created_by !== auth()->id()) abort(403);
}
```

**Option B — Event/trigger controllers** (returns 404 on violation):
```php
// Used in ChatController, ChessController, TienLenController
$app = Application::ownershipAware()
    ->where('enabled', true)
    ->findOrFail($validated['application_id']);
```

Use Option B for any new event-trigger endpoint. Use Option A for CRUD resource controllers.

### Authorization
- **`is_admin` boolean** gates all user management — no RBAC package.
- Use `$this->authorize('create', User::class)` for admin-gated actions (backed by `UserPolicy`).
- `HasOwnership::scopeOwnershipAware()` automatically adds `WHERE created_by = auth()->id()` for non-admins.

### New API Endpoint Checklist
1. Controller in `app/Http/Controllers/Api/`
2. Add route inside `Route::middleware('auth:sanctum')->group(...)` in `routes/api.php`
3. **Stats/custom routes before `apiResource()`** to avoid wildcard conflict
4. Apply ownership with Option A or B above
5. Return `response()->json(['ok' => true])` for operations, full model for CRUD
6. After modifying an Application: call `$application->clearCache()` (invalidates Soketi Redis key)

### Monitor Channel Pattern
All event triggers must dual-broadcast — once to the real channel, once to the monitor channel:
```php
$pusher->trigger($channel, $eventName, $data);
$pusher->trigger('_monitor_' . $app->id, 'monitor.event', [
    'channel' => $channel,
    'event'   => $eventName,
    'data'    => $data,
]);
```

### Database Migrations
Use the `ownerships()` macro for creator/updater tracking:
```php
Schema::create('table_name', function (Blueprint $table) {
    $table->id();
    // ... columns ...
    $table->ownerships(); // adds created_by + updated_by nullable FK columns with indexes
    $table->timestamps();
});
```

### Route Order in `routes/api.php`
Always declare named/custom routes **before** `apiResource()`:
```php
Route::get('/applications/stats', [ApplicationController::class, 'stats']);   // FIRST
Route::get('/applications/{application}/channels', [...]);                    // FIRST
Route::patch('/applications/{application}/toggle', [...]);                    // FIRST
Route::apiResource('/applications', ApplicationController::class);            // LAST
```

### `POST /applications` vs `PUT /applications/{id}` Asymmetry
`store()` intentionally only validates `name` + `enabled`. All limit fields (`max_connections`, etc.) are set via `update()`. Do not add limit fields to the `store()` validation.

---

## Frontend Conventions

### API Client
Always import the axios client as:
```js
import api from '@/lib/axios'
```
The file is `resources/js/lib/axios.js` (not `api.js`). It attaches the Sanctum Bearer token from `localStorage` automatically and redirects to `/login` on 401.

### Adding a New Page
1. Create the page component in `resources/js/pages/<section>/`
2. Import it in `router.jsx`
3. Add a route definition and include it in `routeTree.addChildren([...])`:
```jsx
const myNewRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/my-path',
    component: MyNewPage,
    beforeLoad: requireAuth,  // required for all protected routes
});
```

### Data Fetching Pattern
```jsx
// Query
const { data, isLoading } = useQuery({
    queryKey: ['resource-name', filters],
    queryFn: () => api.get('/endpoint').then(r => r.data),
});

// Mutation
const mutation = useMutation({
    mutationFn: (data) => api.post('/endpoint', data),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['resource-name'] });
        toast({ title: 'Success!', variant: 'success' });
    },
    onError: (err) => {
        if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
    },
});
```

### Route Parameters
```jsx
// In page component
import { useParams } from '@tanstack/react-router';
const { id } = useParams({ strict: false });
```

### Toast Notifications
```js
import { toast } from '@/hooks/useToast';
toast({ title: 'Done!', variant: 'success' });   // or 'destructive'
```

---

## Testing Conventions

### Structure
- All tests in `tests/Feature/` (integration) or `tests/Unit/`
- Use `RefreshDatabase` and `actingAs($user, 'sanctum')` on every test class
- Factory states: `Application::factory()->disabled()`, `User::factory()->inactive()`

### Template for New Endpoint Test
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

    // Required for any endpoint that calls Pusher
    private function mockPusher(): void
    {
        $pusher = $this->createMock(Pusher::class);
        $pusher->method('trigger')->willReturn((object) []);

        $this->mock(PusherService::class, function (MockInterface $mock) use ($pusher) {
            $mock->shouldReceive('make')->andReturn($pusher);
        });
    }

    public function test_owner_can_use_endpoint(): void { /* ... */ }
    public function test_non_owner_gets_404(): void { /* ... */ }       // for trigger endpoints
    public function test_non_owner_gets_403(): void { /* ... */ }       // for resource endpoints
    public function test_disabled_app_returns_404(): void { /* ... */ }
    public function test_unauthenticated_gets_401(): void { /* ... */ }
    public function test_validation_fails_with_missing_fields(): void { /* ... */ }
}
```

### Mocking WebSocket Server (for tests that update/toggle Applications)
```php
use Tests\Concerns\MocksWebSocketServer;

class UpdateApplicationTest extends TestCase
{
    use RefreshDatabase, MocksWebSocketServer;

    public function test_update_clears_cache(): void
    {
        $spy = $this->spyWebSocketServer();
        $user = User::factory()->create(['is_admin' => true]);
        $app = Application::factory()->create(['created_by' => $user->id]);

        $this->actingAs($user, 'sanctum')
            ->putJson("/api/applications/{$app->id}", ['name' => 'New Name', 'enabled' => true]);

        $this->assertCacheClearedFor($app, $spy);
    }
}
```

---

## Build & Development Commands

```bash
# Start all services
docker compose up -d

# PHP
php artisan pint            # REQUIRED before every PHP commit
php artisan test            # Run PHPUnit tests
php artisan migrate         # Run migrations
php artisan optimize:clear  # Clear all caches

# JavaScript
npm run dev     # Vite dev server (hot reload)
npm run build   # Production build → public/build/
npm run test    # Vitest unit tests

# E2E
npx playwright test
```

---

## Key Architectural Facts

- **Blade is only the root shell** (`resources/views/app.blade.php`). Everything else is React.
- **Soketi reads app config from MySQL** and caches in Redis. Cache is invalidated by `$application->clearCache()` which deletes the `soketi_app:{key}` Redis key.
- **`POST /applications`** only saves `name` + `enabled`. Other limit fields require a subsequent `PUT`.
- **Non-admin ownership violations** on trigger endpoints return **404** (via `findOrFail`), not 403.
- **The monitor channel** `_monitor_{appId}` receives a copy of every server-triggered event for the live event stream UI.
- **Default admin**: `admin@email.com` / `password` (set via `SUPER_USER_EMAIL` / `SUPER_USER_PASSWORD` env vars).
