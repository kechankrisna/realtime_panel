import { useState, useCallback } from 'react';
import api from '@/lib/axios';

function getStoredUser() {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function useAuth() {
    const [user, setUser] = useState(getStoredUser);
    const [token, setToken] = useState(() => localStorage.getItem('token'));

    const login = useCallback(async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout');
        } catch {}
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        const { data } = await api.get('/auth/user');
        localStorage.setItem('user', JSON.stringify(data));
        setUser(data);
        return data;
    }, []);

    return { user, token, isAuthenticated: !!token, login, logout, refreshUser };
}
