import { useState, useEffect } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/useToast';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

const WEBHOOK_EVENTS = [
    'channel_occupied', 'channel_vacated', 'member_added', 'member_removed', 'client_event',
];

function NumericField({ label, hint, name, value, onChange, min, max }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <Input type="number" name={name} value={value ?? ''} onChange={onChange} min={min} max={max} />
        </div>
    );
}

function WebhookRepeater({ webhooks = [], onChange }) {
    const add = () => onChange([...webhooks, { url: '', event_types: [], headers: {}, filter: { channel_name_starts_with: '', channel_name_ends_with: '' } }]);
    const remove = (i) => onChange(webhooks.filter((_, idx) => idx !== i));
    const update = (i, field, val) => {
        const updated = [...webhooks];
        updated[i] = { ...updated[i], [field]: val };
        onChange(updated);
    };
    const toggleEvent = (i, ev) => {
        const types = webhooks[i].event_types ?? [];
        update(i, 'event_types', types.includes(ev) ? types.filter((e) => e !== ev) : [...types, ev]);
    };
    const setHeader = (i, key, val, isKey = false) => {
        const headers = { ...webhooks[i].headers };
        if (isKey) {
            const oldKey = Object.keys(headers).find((_, ki) => ki === key);
            const newHeaders = {};
            Object.entries(headers).forEach(([k, v], ki) => { newHeaders[ki === key ? val : k] = v; });
            update(i, 'headers', newHeaders);
        } else {
            const keys = Object.keys(headers);
            const newHeaders = {};
            keys.forEach((k, ki) => { newHeaders[k] = ki === key ? val : headers[k]; });
            update(i, 'headers', newHeaders);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label>Webhooks</Label>
                <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="mr-1 h-3 w-3" />Add webhook</Button>
            </div>
            {webhooks.map((wh, i) => (
                <Card key={i}>
                    <CardContent className="pt-4 space-y-4">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                                <Label>URL</Label>
                                <Input value={wh.url} onChange={(e) => update(i, 'url', e.target.value)} placeholder="https://…" required />
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="mt-6 text-destructive" onClick={() => remove(i)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label>Event Types</Label>
                            <div className="flex flex-wrap gap-2">
                                {WEBHOOK_EVENTS.map((ev) => (
                                    <label key={ev} className="flex cursor-pointer items-center gap-1.5 text-sm">
                                        <input type="checkbox" checked={wh.event_types?.includes(ev)} onChange={() => toggleEvent(i, ev)} className="rounded" />
                                        {ev.replace(/_/g, ' ')}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Filter</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-normal text-muted-foreground">channel_name_starts_with</Label>
                                    <Input value={wh.filter?.channel_name_starts_with ?? ''} onChange={(e) => update(i, 'filter', { ...wh.filter, channel_name_starts_with: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-normal text-muted-foreground">channel_name_ends_with</Label>
                                    <Input value={wh.filter?.channel_name_ends_with ?? ''} onChange={(e) => update(i, 'filter', { ...wh.filter, channel_name_ends_with: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function EditApplicationPage() {
    const { id } = useParams({ from: '/applications/$id/edit' });
    const navigate = useNavigate();
    const qc = useQueryClient();
    const { user } = useAuth();

    const { data: app, isLoading } = useQuery({
        queryKey: ['application', id],
        queryFn: () => api.get(`/applications/${id}`).then((r) => r.data),
    });

    const { data: users } = useQuery({
        queryKey: ['users-list'],
        queryFn: () => api.get('/users', { params: { per_page: 100 } }).then((r) => r.data.data),
        enabled: !!user?.is_admin,
    });

    const [form, setForm] = useState(null);
    useEffect(() => { if (app) setForm({ ...app, webhooks: app.webhooks ?? [] }); }, [app]);

    const [errors, setErrors] = useState({});

    const updateMutation = useMutation({
        mutationFn: (data) => api.put(`/applications/${id}`, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['applications'] });
            qc.invalidateQueries({ queryKey: ['application', id] });
            toast({ title: 'Application updated successfully!', variant: 'success' });
        },
        onError: (err) => {
            if (err.response?.status === 422) setErrors(err.response.data.errors ?? {});
        },
    });

    const deleteMutation = useMutation({
        mutationFn: () => api.delete(`/applications/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['applications'] });
            navigate({ to: '/applications' });
            toast({ title: 'Application deleted.', variant: 'default' });
        },
    });

    if (isLoading || !form) return <AppLayout><div className="p-8 text-center text-muted-foreground">Loading…</div></AppLayout>;

    const set = (field, val) => setForm((f) => ({ ...f, [field]: val }));
    const handleInput = (e) => set(e.target.name, e.target.type === 'number' ? Number(e.target.value) : e.target.value);

    const handleSubmit = (e) => {
        e.preventDefault();
        setErrors({});
        updateMutation.mutate(form);
    };

    return (
        <AppLayout>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="ghost" size="icon" onClick={() => navigate({ to: '/applications' })}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-2xl font-bold">Edit Application</h1>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="destructive" size="sm" onClick={() => { if (confirm('Delete this application?')) deleteMutation.mutate(); }} disabled={deleteMutation.isPending}>
                            Delete
                        </Button>
                        <Button type="submit" disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                        </Button>
                    </div>
                </div>

                <Tabs defaultValue="general">
                    <TabsList>
                        <TabsTrigger value="general">General</TabsTrigger>
                        <TabsTrigger value="limits">Limits</TabsTrigger>
                        <TabsTrigger value="channel">Channel</TabsTrigger>
                        <TabsTrigger value="memory">Memory</TabsTrigger>
                    </TabsList>

                    <TabsContent value="general" className="mt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input name="name" value={form.name} onChange={handleInput} required maxLength={100} />
                                {errors.name && <p className="text-xs text-destructive">{errors.name[0]}</p>}
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-3">
                                    <Switch checked={!!form.enabled} onCheckedChange={(v) => set('enabled', v)} id="enabled" />
                                    <Label htmlFor="enabled">Enabled</Label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switch checked={!!form.enable_client_messages} onCheckedChange={(v) => set('enable_client_messages', v)} id="client-msgs" />
                                    <Label htmlFor="client-msgs">Enable Client Messages</Label>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Switch checked={!!form.enable_user_authentication} onCheckedChange={(v) => set('enable_user_authentication', v)} id="user-auth" />
                                    <Label htmlFor="user-auth">Enable User Authentication</Label>
                                </div>
                            </div>
                            {user?.is_admin && users && (
                                <div className="space-y-2">
                                    <Label>Owner</Label>
                                    <Select value={String(form.created_by ?? '')} onValueChange={(v) => set('created_by', Number(v))}>
                                        <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                                        <SelectContent>
                                            {users.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="limits" className="mt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <NumericField label="Max Connections" hint="-1 = unlimited" name="max_connections" value={form.max_connections} onChange={handleInput} min={-1} />
                            <NumericField label="Max Backend Events/sec" hint="-1 = unlimited" name="max_backend_events_per_sec" value={form.max_backend_events_per_sec} onChange={handleInput} min={-1} />
                            <NumericField label="Max Client Events/sec" hint="-1 = unlimited" name="max_client_events_per_sec" value={form.max_client_events_per_sec} onChange={handleInput} min={-1} />
                            <NumericField label="Max Read Requests/sec" hint="-1 = unlimited" name="max_read_req_per_sec" value={form.max_read_req_per_sec} onChange={handleInput} min={-1} />
                        </div>
                    </TabsContent>

                    <TabsContent value="channel" className="mt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <NumericField label="Max Channel Name Length" name="max_channel_name_length" value={form.max_channel_name_length} onChange={handleInput} min={1} max={127} />
                            <NumericField label="Max Event Name Length" name="max_event_name_length" value={form.max_event_name_length} onChange={handleInput} min={1} max={127} />
                            <NumericField label="Max Presence Members/Channel" hint="-1 = unlimited" name="max_presence_members_per_channel" value={form.max_presence_members_per_channel} onChange={handleInput} min={-1} max={127} />
                            <NumericField label="Max Event Channels at Once" name="max_event_channels_at_once" value={form.max_event_channels_at_once} onChange={handleInput} min={1} max={127} />
                        </div>
                    </TabsContent>

                    <TabsContent value="memory" className="mt-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <NumericField label="Max Event Batch Size" name="max_event_batch_size" value={form.max_event_batch_size} onChange={handleInput} min={10} max={127} />
                            <NumericField label="Max Presence Member Size (KB)" name="max_presence_member_size_in_kb" value={form.max_presence_member_size_in_kb} onChange={handleInput} min={10} max={127} />
                            <NumericField label="Max Event Payload (KB)" name="max_event_payload_in_kb" value={form.max_event_payload_in_kb} onChange={handleInput} min={10} max={127} />
                        </div>
                    </TabsContent>
                </Tabs>

                <WebhookRepeater webhooks={form.webhooks} onChange={(wh) => set('webhooks', wh)} />
            </form>
        </AppLayout>
    );
}
