import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/useToast';
import { Send } from 'lucide-react';

export default function PlaygroundPage() {
    const [appId, setAppId] = useState('');
    const [channel, setChannel] = useState('');
    const [sender, setSender] = useState('Playground');
    const [content, setContent] = useState('Hello from Playground!');

    const { data: appsData } = useQuery({
        queryKey: ['applications-all'],
        queryFn: () => api.get('/applications', { params: { per_page: 999 } }).then((r) => r.data),
    });
    const apps = appsData?.data ?? [];

    const trigger = useMutation({
        mutationFn: (body) => api.post('/chat/trigger', body),
        onSuccess: () => toast({ title: 'Event triggered successfully!', variant: 'success' }),
        onError: (err) => toast({ title: 'Failed to trigger event', description: err.response?.data?.message ?? err.message, variant: 'destructive' }),
    });

    const send = () => {
        if (!appId || !channel || !sender || !content) {
            toast({ title: 'Fill in all fields.', variant: 'destructive' });
            return;
        }
        trigger.mutate({
            application_id: Number(appId),
            channel,
            data: { id: crypto.randomUUID(), sender, content },
        });
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-2xl space-y-6">
                <h1 className="text-2xl font-bold">Playground</h1>
                <p className="text-muted-foreground">Send a test event to any application channel.</p>

                <div className="rounded-lg border p-6 space-y-5">
                    <div className="space-y-2">
                        <Label>Application</Label>
                        <Select value={appId} onValueChange={setAppId}>
                            <SelectTrigger><SelectValue placeholder="Select an app…" /></SelectTrigger>
                            <SelectContent>
                                {apps.map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)}>{a.name} ({a.key})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Channel</Label>
                        <Input placeholder="e.g. my-channel" value={channel} onChange={(e) => setChannel(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Sender</Label>
                            <Input placeholder="e.g. Admin" value={sender} onChange={(e) => setSender(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Content</Label>
                            <Input placeholder="e.g. Hello world" value={content} onChange={(e) => setContent(e.target.value)} />
                        </div>
                    </div>

                    <Button onClick={send} disabled={trigger.isPending} className="w-full">
                        <Send className="mr-2 h-4 w-4" />
                        {trigger.isPending ? 'Sending…' : 'Send Event'}
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
