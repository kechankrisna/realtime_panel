import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { TopNav } from './TopNav';

export function AppLayout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate({ to: '/login' });
    };

    return (
        <div className="flex min-h-full flex-col">
            <TopNav user={user} onLogout={handleLogout} />
            <main className="flex-1">
                <div className="mx-auto max-w-screen-xl px-4 py-6">
                    {children}
                </div>
            </main>
            <footer className="border-t py-4 text-center text-sm text-muted-foreground">
                <span id="app-footer-branding">Soketi Apps</span>
            </footer>
        </div>
    );
}
