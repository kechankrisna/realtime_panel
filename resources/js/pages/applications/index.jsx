import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/useToast';
import { Copy, Plus, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';

function CopyButton({ value }) {
    const copy = () => {
        navigator.clipboard.writeText(value);
        toast({ title: 'Copied!', variant: 'success' });
    };
    return (
        <button onClick={copy} className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground">
            <Copy className="h-3 w-3" />
        </button>
    );
}

function CreateDialog({ onCreated }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: '', enabled: true });
    const [errors, setErrors] = useState({});
    const qc = useQueryClient();

    const mutation = useMutation({
        mutationFn: (data) => api.post('/applications', data),
        onSuccess: () => {
            setOpen(false);
            setForm({ name: '', enabled: true });
            qc.invalidateQueries({ queryKey: ['applications'] });
            qc.invalidateQueries({ queryKey: ['application-stats'] });
            toast({ title: 'Application created successfully!', variant: 'success' });
        },
        onError: (err) => {
            if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
        },
    });

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-1 h-4 w-4" />New Application</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Create Application</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
                        {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} id="create-enabled" />
                        <Label htmlFor="create-enabled">Enabled</Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => { setErrors({}); mutation.mutate(form); }} disabled={mutation.isPending}>
                        {mutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function ApplicationsPage() {
    const [tab, setTab] = useState('all');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const qc = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['applications', tab, search, page],
        queryFn: () => api.get('/applications', { params: { filter: tab === 'all' ? undefined : tab, search: search || undefined, page } }).then((r) => r.data),
    });

    const toggleMutation = useMutation({
        mutationFn: (id) => api.patch(`/applications/${id}/toggle`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['applications'] });
            qc.invalidateQueries({ queryKey: ['application-stats'] });
        },
    });

    const apps = data?.data ?? [];

    return (
        <AppLayout>
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Applications</h1>
                    <CreateDialog />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Tabs value={tab} onValueChange={(v) => { setTab(v); setPage(1); }}>
                        <TabsList>
                            <TabsTrigger value="all">All</TabsTrigger>
                            <TabsTrigger value="active">Active</TabsTrigger>
                            <TabsTrigger value="inactive">Inactive</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <Input
                        placeholder="Search by name, ID or key…"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="sm:w-64"
                    />
                </div>

                <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                {['App ID', 'App Name', 'App Key', 'App Secret', 'Active', 'Creator', 'Updated', 'Created', ''].map((h) => (
                                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading ? (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                            ) : apps.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No applications found.</td></tr>
                            ) : apps.map((app) => (
                                <tr key={app.id} className="hover:bg-muted/30">
                                    <td className="px-4 py-3 font-mono text-xs text-primary">
                                        {app.id}<CopyButton value={String(app.id)} />
                                    </td>
                                    <td className="px-4 py-3 font-medium">{app.name}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-primary">
                                        {app.key}<CopyButton value={app.key} />
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-primary">
                                        {app.secret}<CopyButton value={app.secret} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Switch
                                            checked={app.enabled}
                                            onCheckedChange={() => toggleMutation.mutate(app.id)}
                                            disabled={toggleMutation.isPending}
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground">{app.creator?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{app.updater?.name ?? '—'}</td>
                                    <td className="px-4 py-3 text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-3">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to={`/applications/${app.id}/edit`}><Pencil className="h-3 w-3" /></Link>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {data && data.last_page > 1 && (
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Page {data.current_page} of {data.last_page}</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page === data.last_page} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
