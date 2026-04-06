import { Link, useRouter } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Users, MessageSquare, BookOpen, ChevronDown, Layers, Activity, Play, MessageCircle, FileText, User } from 'lucide-react';

const navItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Applications', href: '/applications', icon: Layers },
    { label: 'Playground', href: '/playground', icon: Play },
    { label: 'Chat', href: '/chat', icon: MessageCircle },
    { label: 'Documentation', href: '/documentation/client', icon: FileText, submenu: [
        { label: 'Client Configuration', href: '/documentation/client' },
        { label: 'Server Configuration', href: '/documentation/server' },
    ]},
];

export function TopNav({ user, onLogout }) {
    const router = useRouter();
    const currentPath = router.state.location.pathname;

    return (
        <header className="sticky top-0 z-40 border-b bg-background">
            <div className="mx-auto flex h-14 max-w-screen-xl items-center gap-6 px-4">
                <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
                    <Activity className="h-5 w-5" />
                    <span>RealtimePanel</span>
                </Link>

                <nav className="flex flex-1 items-center gap-1">
                    {navItems.map((item) => {
                        if (item.label === 'Documentation') {
                            return (
                                <DropdownMenu key={item.label}>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="gap-1">
                                            <item.icon className="h-4 w-4" />
                                            {item.label}
                                            <ChevronDown className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {item.submenu.map((sub) => (
                                            <DropdownMenuItem key={sub.href} asChild>
                                                <Link to={sub.href}>{sub.label}</Link>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        }
                        const active = currentPath === item.href;
                        return (
                            <Button key={item.href} variant={active ? 'secondary' : 'ghost'} size="sm" asChild>
                                <Link to={item.href} className="flex items-center gap-1.5">
                                    <item.icon className="h-4 w-4" />
                                    {item.label}
                                </Link>
                            </Button>
                        );
                    })}

                    {user?.is_admin && (
                        <Button variant={currentPath.startsWith('/users') ? 'secondary' : 'ghost'} size="sm" asChild>
                            <Link to="/users" className="flex items-center gap-1.5">
                                <User className="h-4 w-4" />
                                Users
                            </Link>
                        </Button>
                    )}
                </nav>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                                {user?.name?.[0]?.toUpperCase()}
                            </div>
                            <span className="hidden sm:inline">{user?.name}</span>
                            <ChevronDown className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link to="/profile">Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                            Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
