import { useState, useEffect } from 'react';
import { useRouter, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/useToast';
import { ArrowLeft, Trash2 } from 'lucide-react';

export default function EditUserPage() {
    const { id } = useParams({ from: '/users/$id/edit' });
    const router = useRouter();
    const { user: authUser } = useAuth();
    const qc = useQueryClient();

    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [deleteOpen, setDeleteOpen] = useState(false);

    const isSelf = authUser?.id === Number(id);

    const { data: userData, isLoading } = useQuery({
        queryKey: ['user', id],
        queryFn: () => api.get(`/users/${id}`).then((r) => r.data),
    });

    useEffect(() => {
        if (userData && !form) {
            setForm({ name: userData.name, email: userData.email, password: '', is_active: !!userData.is_active, is_admin: !!userData.is_admin });
        }
    }, [userData]);

    const updateMutation = useMutation({
        mutationFn: (data) => api.put(`/users/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['users'] });
            qc.invalidateQueries({ queryKey: ['user', id] });
            toast({ title: 'User updated successfully!', variant: 'success' });
        },
        onError: (err) => {
            if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => api.delete(`/users/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['users'] });
            router.navigate({ to: '/users' });
            toast({ title: 'User deleted.', variant: 'info' });
        },
    });

    const save = () => {
        setErrors({});
        const payload = { name: form.name, email: form.email, is_active: form.is_active, is_admin: form.is_admin };
        if (form.password) payload.password = form.password;
        updateMutation.mutate(payload);
    };

    if (isLoading || !form) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center py-24 text-muted-foreground">Loading…</div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => router.navigate({ to: '/users' })}>
                        <ArrowLeft className="mr-1 h-4 w-4" />Back
                    </Button>
                    <h1 className="text-2xl font-bold">Edit User</h1>
                </div>

                <div className="rounded-lg border p-6 space-y-5">
                    {[['Name', 'name', 'text'], ['Email', 'email', 'email']].map(([label, field, type]) => (
                        <div key={field} className="space-y-2">
                            <Label>{label}</Label>
                            <Input type={type} value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
                            {errors[field] && <p className="text-xs text-destructive">{errors[field][0]}</p>}
                        </div>
                    ))}

                    <div className="space-y-2">
                        <Label>New Password <span className="text-muted-foreground text-xs">(leave blank to keep current)</span></Label>
                        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                        {errors.password && <p className="text-xs text-destructive">{errors.password[0]}</p>}
                    </div>

                    {!isSelf && (
                        <div className="flex gap-6">
                            <div className="flex items-center gap-2">
                                <Switch id="e-active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                                <Label htmlFor="e-active">Active</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id="e-admin" checked={form.is_admin} onCheckedChange={(v) => setForm({ ...form, is_admin: v })} />
                                <Label htmlFor="e-admin">Admin</Label>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    {!isSelf && (
                        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                            <Trash2 className="mr-1 h-4 w-4" />Delete
                        </Button>
                    )}
                    {isSelf && <span />}
                    <Button onClick={save} disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
                    <p>Are you sure you want to delete this user? This action cannot be undone.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => { setDeleteOpen(false); deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
