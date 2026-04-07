import { useState, useEffect } from 'react';

const STORAGE_KEY = 'realtimepanel-theme';

function applyTheme(theme) {
    const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
}

export function useTheme() {
    const [theme, setThemeState] = useState(
        () => localStorage.getItem(STORAGE_KEY) ?? 'system'
    );

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    // Re-apply when system preference changes (only relevant in 'system' mode)
    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => { if (theme === 'system') applyTheme('system'); };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = (newTheme) => {
        localStorage.setItem(STORAGE_KEY, newTheme);
        setThemeState(newTheme);
    };

    // Cycle: system → light → dark → system
    const cycleTheme = () => {
        const next = { system: 'light', light: 'dark', dark: 'system' };
        setTheme(next[theme] ?? 'system');
    };

    return { theme, setTheme, cycleTheme };
}
