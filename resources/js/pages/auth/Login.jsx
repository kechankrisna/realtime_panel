import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Sun, Moon, Monitor } from 'lucide-react';

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

function LoginThemeToggle() {
    const { theme, cycleTheme } = useTheme();
    const Icon = themeIcons[theme] ?? Monitor;
    return (
        <button
            onClick={cycleTheme}
            title="Toggle theme"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
            <Icon className="h-4 w-4" />
        </button>
    );
}

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        setLoading(true);
        try {
            await login(form.email, form.password);
            navigate({ to: '/' });
        } catch (err) {
            if (err.response?.status === 422) {
                setErrors(err.response.data.errors ?? { email: [err.response.data.message] });
            } else if (err.response?.status === 429) {
                setErrors({ email: ['Too many login attempts. Please try again later.'] });
            } else {
                setErrors({ email: ['An unexpected error occurred.'] });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
            {/* Liquid Glass ambient orbs */}
            <div className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden">
                <div className="animate-blob absolute -left-48 -top-48 h-[550px] w-[550px] rounded-full bg-primary/30 blur-[110px] dark:bg-primary/20" />
                <div className="animate-blob animation-delay-7 absolute -right-48 top-0 h-[450px] w-[450px] rounded-full bg-indigo-500/25 blur-[90px] dark:bg-indigo-500/15" />
                <div className="animate-blob animation-delay-12 absolute bottom-0 left-1/2 h-[450px] w-[450px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-[90px] dark:bg-violet-500/10" />
            </div>
            <div className="absolute right-4 top-4">
                <LoginThemeToggle />
            </div>
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <div className="mb-4 flex justify-center">
                        <Activity className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle>Welcome back</CardTitle>
                    <CardDescription>Please sign in to your account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                autoComplete="email"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="you@example.com"
                                required
                            />
                            {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                autoComplete="current-password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                            />
                            {errors.password && <p className="text-xs text-destructive">{errors.password[0]}</p>}
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign in'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
