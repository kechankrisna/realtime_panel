#!/usr/bin/env bash

# Root based on Dockerfile WORKDIR
# Fix ownership so the soketi user can write to the mounted volume
chown -R soketi:soketi /var/www/html

if [ ! -d vendor ]; then
    echo "Installing application dependencies..."
    gosu soketi composer install --no-interaction
fi

if [ ! -d public/build ]; then
    echo "Installing JS dependencies and building frontend assets..."
    gosu soketi npm install --no-audit --prefer-offline
    gosu soketi npm run build
fi

if grep -q "^APP_KEY=\s*$" .env; then
    echo "Generating application key..."
    gosu soketi php artisan key:generate -q
fi

if gosu soketi php artisan migrate --force -q; then
    echo "Migrating application database..."
fi

echo "Setting up super admin..."
gosu soketi php artisan app:setup-admin

echo "Caching configuration..."
gosu soketi php artisan optimize

echo "Starting php-fpm server..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
