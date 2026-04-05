import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.jsx'],
            refresh: true,
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['resources/js/tests/setup.js'],
        include: ['resources/js/tests/**/*.test.{js,jsx}'],
    },
});
