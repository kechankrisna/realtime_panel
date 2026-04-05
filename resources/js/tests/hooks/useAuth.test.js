import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

// Mock the axios module used by useAuth
vi.mock('@/lib/axios', () => ({
    default: {
        post: vi.fn(),
        get: vi.fn(),
    },
}));

import api from '@/lib/axios';

const fakeUser = { id: 1, name: 'Alice', email: 'alice@example.com', is_admin: false, is_active: true };
const fakeToken = 'test-token-123';

beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
});

afterEach(() => {
    localStorage.clear();
});

describe('useAuth', () => {
    it('initialises with null user when localStorage is empty', () => {
        const { result } = renderHook(() => useAuth());
        expect(result.current.user).toBeNull();
        expect(result.current.token).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('initialises with stored user and token', () => {
        localStorage.setItem('token', fakeToken);
        localStorage.setItem('user', JSON.stringify(fakeUser));

        const { result } = renderHook(() => useAuth());
        expect(result.current.user).toEqual(fakeUser);
        expect(result.current.token).toBe(fakeToken);
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('login stores token and user', async () => {
        api.post.mockResolvedValueOnce({ data: { token: fakeToken, user: fakeUser } });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.login('alice@example.com', 'password');
        });

        expect(localStorage.getItem('token')).toBe(fakeToken);
        expect(JSON.parse(localStorage.getItem('user'))).toEqual(fakeUser);
        expect(result.current.user).toEqual(fakeUser);
        expect(result.current.isAuthenticated).toBe(true);
    });

    it('login returns user data', async () => {
        api.post.mockResolvedValueOnce({ data: { token: fakeToken, user: fakeUser } });

        const { result } = renderHook(() => useAuth());

        let returnedUser;
        await act(async () => {
            returnedUser = await result.current.login('alice@example.com', 'password');
        });

        expect(returnedUser).toEqual(fakeUser);
    });

    it('logout clears localStorage and state', async () => {
        localStorage.setItem('token', fakeToken);
        localStorage.setItem('user', JSON.stringify(fakeUser));
        api.post.mockResolvedValueOnce({});

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.logout();
        });

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('logout succeeds even when API call fails', async () => {
        localStorage.setItem('token', fakeToken);
        localStorage.setItem('user', JSON.stringify(fakeUser));
        api.post.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.logout();
        });

        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
    });

    it('refreshUser updates stored and state user', async () => {
        const updatedUser = { ...fakeUser, name: 'Alice Updated' };
        api.get.mockResolvedValueOnce({ data: updatedUser });

        localStorage.setItem('token', fakeToken);
        localStorage.setItem('user', JSON.stringify(fakeUser));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
            await result.current.refreshUser();
        });

        expect(result.current.user).toEqual(updatedUser);
        expect(JSON.parse(localStorage.getItem('user'))).toEqual(updatedUser);
    });
});
