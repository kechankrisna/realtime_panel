# Soketi Apps

A full-featured management dashboard for [Soketi](https://soketi.app/) — the open-source, self-hosted WebSocket server. Built with **Laravel 10**, **React 19**, **shadcn/ui**, and **TanStack Router/Query**.

![Dashboard](screenshots/dashboard.png)

---

## Features

### Application Management
- Create, view, edit, delete, and filter Soketi applications
- Toggle application status (enabled / disabled) in one click
- Per-application configuration: connection limits, event rate limits, channel/event name length, payload size, presence member counts
- Interactive webhook management — add, remove, and configure webhook URLs with per-event type filters and custom headers
- Automatic Soketi application cache invalidation on every change

### Live Monitor
- Real-time WebSocket event monitoring at `/applications/:id/monitor`
- Dedicated relay channel (`_monitor_{id}`) receives every triggered event independently of whether other clients are connected
- Collapsible JSON tree viewer for event data
- Filter by event name or channel, Pause / Resume, Clear, Export to JSON
- Stats bar: total events, displayed, events/min, uptime
- Categories: system (pusher:*), internal (pusher_internal:*), client (client-*), server

### Dashboard
- Live Soketi server statistics: active connections, peak connections, socket counts
- JS heap usage gauge with auto-scaling smart status (ok / warning / critical)
- System uptime and resource stats
- Application stats summary

### User Management
- Create and manage users with admin / non-admin roles
- Toggle user active status
- In-app profile editing (name, email, password)

### Galleries — Live Demo Apps
Three fully playable real-time applications included to demonstrate WebSocket capabilities:

| App | Description |
|-----|-------------|
| **Chat** | Real-time group chat — select any app, join any channel, send messages instantly |
| **Chess** | Play vs a minimax AI or challenge another player via a Soketi room code |
| **Tiến Lên** | Vietnamese card game for up to 4 players — play vs bots or host a live room |

All three have a casino-style UI with dark/light mode support.

### Playground
Send arbitrary events to any application channel directly from the browser — useful for testing integrations without writing any code.

### Documentation
Built-in client and server integration guides, pre-filled with your live server connection details.

### Theme
Full light / dark / system theme support persisted to `localStorage`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Laravel 10, PHP 8.1+, Laravel Sanctum, Pusher PHP Server SDK |
| Frontend | React 19, TanStack Router v1, TanStack Query v5, TanStack Table v8 |
| UI | shadcn/ui, Tailwind CSS 3, Radix UI, Lucide React |
| WebSockets | Soketi, Laravel Echo, pusher-js 8 |
| Database | MySQL 8 or PostgreSQL 13+ |
| Cache / Queue | Redis 7 |
| Build | Vite 5 |

---

## Requirements

- Docker & Docker Compose (recommended) **or**
- PHP 8.1+, Composer 2, Node.js 18+, MySQL 8 / PostgreSQL 13+, Redis 6+
- A running Soketi instance configured with MySQL/PostgreSQL app manager and Redis caching

---

## Quick Start with Docker

```bash
# 1. Clone the repository
git clone https://github.com/kechankrisna/soketi-apps.git
cd soketi-apps

# 2. Copy the environment file and fill in your values
cp .env.example .env

# 3. Build and start all services
docker compose up -d --build

# 4. Run database migrations and seed the first admin user
docker compose exec soketi-apps php artisan migrate --seed
```

The stack spins up five containers:

| Container | Role | Port |
|-----------|------|------|
| `soketi-apps` | Laravel + PHP-FPM | — |
| `soketi-apps-nginx` | Nginx reverse proxy | `80` (configurable via `APP_PORT`) |
| `soketi-websocket-server` | Soketi WebSocket server | `6001` (internal) |
| `soketi-apps-mysql` | MySQL 8 database | — (internal) |
| `soketi-apps-redis` | Redis 7 cache / queue | — (internal) |

Open **http://localhost** in your browser.

Default credentials after seeding:
```
Email:    admin@email.com
Password: password
```

---

## Manual Installation (without Docker)

```bash
# Clone the repo
git clone https://github.com/kechankrisna/soketi-apps.git
cd soketi-apps

# Install PHP dependencies
composer install

# Install JS dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — set DB_*, REDIS_*, PUSHER_HOST, PUSHER_PORT, SOKETI_* variables

# Generate application key
php artisan key:generate

# Run migrations and seed
php artisan migrate --seed

# Build frontend assets
npm run build

# Start the development server
php artisan serve

# Install Soketi websocket server
npm install -g @soketi/soketi

# Run Soketi server
soketi start
```

## Docker Installation

Some considerations -

- Port `80` is exposed through nginx by default. Change the `APP_PORT` in `.env` before running `docker compose up -d` if there's conflict.
- Nginx is configured to handle websocket requests as well. No need to expose Soketi port `6001` for websockets. Use the `APP_PORT` instead.

```bash
# Clone or download the repo
git clone https://github.com/kechankrisna/soketi-apps.git

# Go to the directory
cd soketi-apps

# Copy .env.docker.example to .env
cp .env.docker.example .env

# Change the necessary variables
nano .env

# Build the image
docker compose build

# Run the application
# Give it some time to -
# > Install composer dependencies
# > Generate application key
# > Run database migration (with --seed to create the admin user)
php artisan serve
```

---

## Environment Variables

Key variables to configure in `.env`:

```dotenv
APP_NAME="Soketi Apps"
APP_URL=http://localhost
APP_KEY=           # generated by php artisan key:generate

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=soketi_app_manager
DB_USERNAME=soketi
DB_PASSWORD=password

REDIS_HOST=redis
REDIS_PASSWORD=password
REDIS_PORT=6379

# Soketi connection — used by the PHP backend to trigger events
PUSHER_HOST=soketi        # hostname of the Soketi container
PUSHER_PORT=6001
PUSHER_SCHEME=http
PUSHER_APP_CLUSTER=

# Soketi process settings
SOKETI_APP_MANAGER_DRIVER=mysql
SOKETI_APP_MANAGER_MYSQL_TABLE=applications
SOKETI_DB_MYSQL_HOST=mysql
SOKETI_DB_MYSQL_PORT=3306
SOKETI_DB_MYSQL_USERNAME=soketi
SOKETI_DB_MYSQL_PASSWORD=password
SOKETI_DB_MYSQL_DATABASE=soketi_app_manager
SOKETI_DB_REDIS_HOST=redis
SOKETI_DB_REDIS_PASSWORD=password
SOKETI_METRICS_ENABLED=true
```

---

## Deploying to Coolify

1. Create a **Docker Compose** application in Coolify and paste the contents of `docker-compose.coolify.yml`.
2. Deploy your preferred **MySQL or PostgreSQL**, **Redis**, and **Soketi** services separately in Coolify.
3. In the **Environment Variables** tab of the Soketi Apps service, fill in the database, Redis, and Soketi connection values — leave `APP_KEY` empty for now.
4. Click **Save** and **Deploy**.
5. Open the service terminal and run:
   ```bash
   # Get the key to paste into APP_KEY
   php artisan key:generate --show

   # Seed the admin user
   php artisan db:seed
   ```
6. Set `APP_KEY` in the environment variables and **Restart** the service.

---

## Development

```bash
# Start Vite dev server (hot reload)
npm run dev

# Build for production
npm run build

# Run PHP tests
php artisan test

# Format PHP code
./vendor/bin/pint

# Clear all caches
php artisan optimize:clear
```

---

## API Reference

The backend exposes a RESTful JSON API under `/api`, authenticated via Laravel Sanctum bearer tokens.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Obtain a Sanctum token |
| `POST` | `/api/auth/logout` | Revoke the current token |
| `GET` | `/api/auth/user` | Get the authenticated user |
| `PUT` | `/api/auth/user` | Update profile |
| `GET` | `/api/applications` | List applications (paginated) |
| `POST` | `/api/applications` | Create application |
| `GET` | `/api/applications/{id}` | Get application |
| `PUT` | `/api/applications/{id}` | Update application |
| `DELETE` | `/api/applications/{id}` | Delete application |
| `PATCH` | `/api/applications/{id}/toggle` | Toggle enabled status |
| `GET` | `/api/applications/{id}/channels` | List currently occupied channels |
| `GET` | `/api/applications/stats` | App counts (total / active / inactive) |
| `GET` | `/api/users` | List users (paginated) |
| `POST` | `/api/users` | Create user |
| `PUT` | `/api/users/{id}` | Update user |
| `GET` | `/api/metrics` | Soketi server metrics |
| `GET` | `/api/config` | Public server config (host, port, app name) |
| `POST` | `/api/chat/trigger` | Trigger a chat message event |
| `POST` | `/api/chess/trigger` | Trigger a chess game event |
| `POST` | `/api/tienlen/trigger` | Trigger a Tiến Lên game event |

---

## Monitor Page — How It Works

The Live Monitor at `/applications/:id/monitor` uses Soketi's WebSocket connection directly in the browser. It works via a **dedicated relay channel** pattern:

1. **Backend relay**: Every trigger controller (`ChatController`, `ChessController`, `TienLenController`) fires a second `$pusher->trigger('_monitor_{appId}', 'monitor.event', [...])` message wrapping the original channel, event name, and payload.
2. **Browser subscription**: The monitor page connects with the app's key and subscribes to `_monitor_{id}` — one stable channel that always has at least one subscriber (the monitor itself).
3. **Frame interception**: `ws.onmessage` is patched on `pusher.connection.connection.transport.socket` (the raw WebSocket inside pusher-js) to capture all frames including system events such as `pusher:connection_established` and `pusher_internal:subscription_succeeded`.
4. **Unwrapping**: `monitor.event` frames are unwrapped to display the real channel, real event name, and real data rather than the relay channel name.

This approach means the monitor shows events in real time regardless of whether any other client is connected to the original channel.

---

## Screenshots

### Login
<img src="screenshots/login.png" width="100%" alt="Login page" />

### Dashboard (Dark Mode)
<img src="screenshots/dashboard.png" width="100%" alt="Dashboard — dark mode" />

### Dashboard (Light Mode)
<img src="screenshots/dashboard-light.png" width="100%" alt="Dashboard — light mode" />

### Applications
<img src="screenshots/view-apps.png" width="100%" alt="Applications list" />

### Edit Application
<img src="screenshots/edit-app.png" width="100%" alt="Edit application" />

### Live Monitor
<img src="screenshots/monitor.png" width="100%" alt="Live WebSocket event monitor" />

### Users
<img src="screenshots/users.png" width="100%" alt="User management" />

### Playground
<img src="screenshots/playground.png" width="100%" alt="Event playground" />

### Galleries
<img src="screenshots/galleries.png" width="100%" alt="Feature galleries" />

### Chat Demo
<img src="screenshots/galleries-chat.png" width="100%" alt="Real-time chat demo" />

### Chess Demo
<img src="screenshots/galleries-chess.png" width="100%" alt="Multiplayer chess demo" />

### Tiến Lên Card Game
<img src="screenshots/galleries-tienlen.png" width="100%" alt="Tiến Lên card game demo" />

### Client Documentation
<img src="screenshots/docs-client.png" width="100%" alt="Client-side SDK documentation" />

### Server Documentation
<img src="screenshots/docs-server.png" width="100%" alt="Server-side API documentation" />

### Profile
<img src="screenshots/profile.png" width="100%" alt="User profile" />

---

## Security

Report security vulnerabilities by email rather than opening a public issue.

---

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE) for details.
