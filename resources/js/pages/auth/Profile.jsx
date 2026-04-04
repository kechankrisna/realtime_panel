import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/useToast';

export default function ProfilePage() {
    const { user, refreshUser } = useAuth();
    const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
    const [errors, setErrors] = useState({});

    const mutation = useMutation({
        mutationFn: (data) => api.put('/auth/user', data),
        onSuccess: async () => {
            await refreshUser();
            toast({ title: 'Profile updated', variant: 'success' });
            setForm((f) => ({ ...f, password: '' }));
        },
        onError: (err) => {
            if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
        },
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({});
        const payload = { name: form.name, email: form.email };
        if (form.password) payload.password = form.password;
        mutation.mutate(payload);
    };

    return (
        <AppLayout>
            <div className="max-w-lg">
                <h1 className="mb-6 text-2xl font-bold">Profile</h1>
                <Card>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                                {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Email</Label>
                                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                                {errors.email && <p className="text-xs text-destructive">{errors.email[0]}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>New Password <span className="text-muted-foreground">(leave blank to keep current)</span></Label>
                                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                                {errors.password && <p className="text-xs text-destructive">{errors.password[0]}</p>}
                            </div>
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? 'Saving...' : 'Save changes'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
