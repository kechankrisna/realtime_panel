import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { createEcho } from '@/lib/echo';
import { Send } from 'lucide-react';

export default function ChatPage() {
    const { user } = useAuth();
    const [appId, setAppId] = useState('');
    const [appKey, setAppKey] = useState('');
    const [channel, setChannel] = useState('chat');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [connected, setConnected] = useState(false);
    const echoRef = useRef(null);
    const bottomRef = useRef(null);

    const { data: appsData } = useQuery({
        queryKey: ['applications-all'],
        queryFn: () => api.get('/applications', { params: { per_page: 999 } }).then((r) => r.data),
    });
    const apps = appsData?.data ?? [];

    // Scroll to bottom on new messages
    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // Connect / disconnect Echo when app selection changes
    useEffect(() => {
        if (echoRef.current) {
            echoRef.current.disconnect();
            echoRef.current = null;
            setConnected(false);
        }
        if (!appKey || !channel) return;

        const echo = createEcho({ key: appKey });
        echoRef.current = echo;

        // Track connection state via Pusher native connection events
        const conn = echo.connector.pusher.connection;
        conn.bind('connected', () => setConnected(true));
        conn.bind('disconnected', () => setConnected(false));
        conn.bind('failed', () => setConnected(false));
        conn.bind('unavailable', () => setConnected(false));

        echo.channel(channel).listen('.message', (e) => {
            setMessages((prev) => [...prev, { ...e, ts: Date.now() }]);
        });

        return () => {
            echo.disconnect();
            echoRef.current = null;
            setConnected(false);
        };
    }, [appKey, channel]);

    const trigger = useMutation({
        mutationFn: (msg) => api.post('/chat/trigger', {
            application_id: Number(appId),
            channel,
            data: { id: crypto.randomUUID(), sender: user?.name ?? 'You', content: msg },
        }),
    });

    const handleAppChange = (id) => {
        setAppId(id);
        const found = apps.find((a) => String(a.id) === id);
        setAppKey(found?.key ?? '');
        setMessages([]);
    };

    const send = () => {
        const text = message.trim();
        if (!text || !appId) return;
        setMessage('');
        trigger.mutate(text);
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-2xl flex flex-col gap-4 h-[calc(100vh-10rem)]">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Chat</h1>
                    <Badge variant={connected ? 'success' : 'secondary'}>{connected ? 'Connected' : 'Disconnected'}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Application</Label>
                        <Select value={appId} onValueChange={handleAppChange}>
                            <SelectTrigger><SelectValue placeholder="Select an app…" /></SelectTrigger>
                            <SelectContent>
                                {apps.map((a) => (
                                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Channel</Label>
                        <Input placeholder="e.g. chat" value={channel} onChange={(e) => setChannel(e.target.value)} />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto rounded-lg border p-4 space-y-2 bg-muted/20">
                    {messages.length === 0 ? (
                        <p className="text-center text-muted-foreground text-sm pt-8">
                            {appId ? 'No messages yet. Say something!' : 'Select an application to start chatting.'}
                        </p>
                    ) : (
                        messages.map((m) => (
                            <div key={m.ts} className="rounded-md bg-background border px-3 py-2 text-sm">
                                <span className="font-semibold text-primary">{m.sender ?? 'Unknown'}: </span>
                                <span>{m.content}</span>
                            </div>
                        ))
                    )}
                    <div ref={bottomRef} />
                </div>

                <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
                    <Input
                        placeholder="Type a message…"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={!appId || !connected}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={!appId || !connected || trigger.isPending}>
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
