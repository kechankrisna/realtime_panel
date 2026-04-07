#!/usr/bin/env bash
set -e

echo "==> Pulling latest code..."
git pull

echo "==> Building frontend assets..."
docker compose --profile deploy run --rm deploy

echo "==> Clearing and rebuilding Laravel cache..."
docker compose exec realtime-panel php artisan optimize:clear
docker compose exec realtime-panel php artisan migrate --force
docker compose exec realtime-panel php artisan optimize

echo "==> Done. Site updated."
