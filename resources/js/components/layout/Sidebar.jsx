import { useState } from 'react';
import { Link, useRouter, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Activity, LayoutDashboard, Layers, Play, LayoutGrid, FileText, BookOpen, Users, Menu, X, Pin, PinOff, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const navItems = [
    { label: 'Dashboard',    href: '/',                     icon: LayoutDashboard },
    { label: 'Applications', href: '/applications',          icon: Layers },
    { label: 'Playground',   href: '/playground',            icon: Play },
    { label: 'Galleries',    href: '/galleries',             icon: LayoutGrid },
    { label: 'Client Docs',  href: '/documentation/client',  icon: FileText },
    { label: 'Server Docs',  href: '/documentation/server',  icon: BookOpen },
];

// ── Module-level so they are never recreated on Sidebar re-render ──

function UserAvatar({ name }) {
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {name?.[0]?.toUpperCase()}
        </div>
    );
}

function UserMenu({ user, expanded, side, onOpenChange }) {
    const navigate   = useNavigate();
    const { logout } = useAuth();

    const handleLogout = async () => {
        await logout();
        navigate({ to: '/login' });
    };

    return (
        <DropdownMenu onOpenChange={onOpenChange}>
            <DropdownMenuTrigger asChild>
                <button className={cn(
                    'flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent focus:outline-none',
                    expanded ? 'gap-3' : 'justify-center'
                )}>
                    <UserAvatar name={user?.name} />
                    {expanded && (
                        <div className="min-w-0 text-left">
                            <p className="truncate text-sm font-medium leading-tight">{user?.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={side} align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: '/profile' })}>
                    Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} className="text-destructive focus:text-destructive">
                    Sign out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const themeIcons = { light: Sun, dark: Moon, system: Monitor };
const themeLabels = { light: 'Light', dark: 'Dark', system: 'System' };
const themeNext = { light: 'Dark', dark: 'System', system: 'Light' };

function ThemeToggle({ expanded }) {
    const { theme, cycleTheme } = useTheme();
    const Icon = themeIcons[theme] ?? Monitor;
    const label = themeLabels[theme] ?? 'System';
    const next = themeNext[theme] ?? 'Light';

    const btn = (
        <button
            onClick={cycleTheme}
            title={`Switch to ${next} mode`}
            className={cn(
                'flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors',
                'text-muted-foreground hover:bg-accent hover:text-foreground',
                expanded ? 'gap-3' : 'justify-center'
            )}
        >
            <Icon className="h-4 w-4 shrink-0" />
            {expanded && <span className="whitespace-nowrap">{label} mode</span>}
        </button>
    );

    if (!expanded) {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right">{label} mode — click for {next}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }
    return btn;
}

function NavItem({ label, href, icon: Icon, active, expanded, onClick }) {
    const link = (
        <Link
            to={href}
            onClick={onClick}
            className={cn(
                'flex w-full items-center rounded-md px-2 py-2 text-sm transition-colors',
                expanded ? 'gap-3' : 'justify-center',
                active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
        >
            <Icon className="h-4 w-4 shrink-0" />
            {expanded && <span className="whitespace-nowrap">{label}</span>}
        </Link>
    );

    if (!expanded) {
        return (
            <TooltipProvider delayDuration={0}>
                <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return link;
}

export function Sidebar({ pinned, onPinToggle }) {
    const [hovered, setHovered]           = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileOpen, setMobileOpen]     = useState(false);
    const { user }                        = useAuth();
    const router                          = useRouter();
    const currentPath                     = router.state.location.pathname;
    const expanded                        = pinned || hovered;

    const isActive = (href) =>
        href === '/' ? currentPath === '/' : currentPath.startsWith(href);

    // Don't collapse while the Radix portal dropdown is open
    const handleMouseLeave = () => {
        if (!dropdownOpen) setHovered(false);
    };

    const handleDropdownChange = (open) => {
        setDropdownOpen(open);
        if (open) setHovered(true); // keep sidebar expanded while dropdown is open
    };

    return (
        <>
            {/* ── Desktop sidebar ── */}
            <aside
                className={cn(
                    'fixed left-0 top-0 z-40 hidden h-full flex-col border-r sm:flex glass',
                    'overflow-hidden transition-[width] duration-200 ease-in-out',
                    expanded ? 'w-52' : 'w-16'
                )}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={handleMouseLeave}
            >
                {/* Logo row */}
                <div className="flex h-14 shrink-0 items-center border-b px-3">
                    <Link to="/" className="flex min-w-0 items-center gap-2.5 text-primary">
                        <Activity className="h-5 w-5 shrink-0" />
                        {expanded && <span className="truncate font-semibold">Soketi Apps</span>}
                    </Link>
                    {expanded && (
                        <button
                            onClick={onPinToggle}
                            title={pinned ? 'Unpin sidebar' : 'Pin sidebar'}
                            className="ml-auto shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                            {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                    )}
                </div>

                {/* Nav items */}
                <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                    {navItems.map((item) => (
                        <NavItem
                            key={item.href}
                            {...item}
                            active={isActive(item.href)}
                            expanded={expanded}
                        />
                    ))}

                    {user?.is_admin && (
                        <>
                            <div className={cn('pt-2', expanded ? 'px-2' : 'border-t')}>
                                {expanded && (
                                    <p className="pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                                        Admin
                                    </p>
                                )}
                            </div>
                            <NavItem
                                label="Users"
                                href="/users"
                                icon={Users}
                                active={isActive('/users')}
                                expanded={expanded}
                            />
                        </>
                    )}
                </nav>

                {/* Theme toggle */}
                <div className="shrink-0 border-t p-2">
                    <ThemeToggle expanded={expanded} />
                </div>

                {/* User section */}
                <div className="shrink-0 border-t p-2">
                    {!expanded ? (
                        <TooltipProvider delayDuration={0}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div>
                                        <UserMenu
                                            user={user}
                                            expanded={false}
                                            side="right"
                                            onOpenChange={handleDropdownChange}
                                        />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right">{user?.name}</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <UserMenu
                            user={user}
                            expanded={true}
                            side="right"
                            onOpenChange={handleDropdownChange}
                        />
                    )}
                </div>
            </aside>

            {/* ── Mobile top bar ── */}
            <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center gap-3 border-b px-4 sm:hidden glass">
                <button
                    onClick={() => setMobileOpen(true)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                    <Menu className="h-5 w-5" />
                </button>
                <Link to="/" className="flex items-center gap-2 font-semibold text-primary">
                    <Activity className="h-5 w-5" />
                    <span>Soketi Apps</span>
                </Link>
                <div className="ml-auto">
                    <UserMenu user={user} expanded={true} side="bottom" onOpenChange={() => {}} />
                </div>
            </div>

            {/* ── Mobile drawer ── */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 sm:hidden">
                    <div
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setMobileOpen(false)}
                    />
                    <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r glass shadow-2xl">
                        <div className="flex h-14 items-center justify-between border-b px-4">
                            <Link
                                to="/"
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2 font-semibold text-primary"
                            >
                                <Activity className="h-5 w-5" />
                                <span>Soketi Apps</span>
                            </Link>
                            <button
                                onClick={() => setMobileOpen(false)}
                                className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    to={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                                        isActive(item.href)
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                    )}
                                >
                                    <item.icon className="h-4 w-4 shrink-0" />
                                    <span>{item.label}</span>
                                </Link>
                            ))}

                            {user?.is_admin && (
                                <>
                                    <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                                        Admin
                                    </p>
                                    <Link
                                        to="/users"
                                        onClick={() => setMobileOpen(false)}
                                        className={cn(
                                            'flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors',
                                            isActive('/users')
                                                ? 'bg-primary/10 text-primary font-medium'
                                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                                        )}
                                    >
                                        <Users className="h-4 w-4 shrink-0" />
                                        <span>Users</span>
                                    </Link>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            )}
        </>
    );
}
