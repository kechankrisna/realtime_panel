<x-filament-panels::page>

    {{-- CDN scripts — always loaded so they're available after Livewire morphing --}}
    <script src="https://js.pusher.com/8.4/pusher.min.js"></script>
    <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

    @if (!$this->joined)
        {{-- ── Join Form ─────────────────────────────────────────── --}}
        <x-filament::section>
            <x-slot name="heading">Join a Chat Room</x-slot>
            <x-slot name="description">Select an application and enter a channel name to start chatting in real time.</x-slot>

            <x-filament-panels::form wire:submit="join">
                {{ $this->form }}

                <x-filament::button type="submit" icon="heroicon-o-arrow-right-circle">
                    Join Chat
                </x-filament::button>
            </x-filament-panels::form>
        </x-filament::section>
    @else
        {{-- ── Chat UI ───────────────────────────────────────────── --}}
        <button id="livewire-leave-btn" wire:click="leave" style="display:none" aria-hidden="true"></button>

        <style>
            .fi-topbar { position: sticky; top: 0; z-index: 40; }
            #soketi-chat-root {
                height: calc(100vh - 4rem);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border-radius: 0.5rem;
                box-shadow: 0 0 40px rgba(0,0,0,0.12);
            }
        </style>

        <div id="soketi-chat-root"></div>
    @endif

    {{-- @script runs reliably inside Livewire, even after component updates --}}
    @script
    <script>
        // Listen for the chat-ready event dispatched by Chat::join()
        $wire.on('chat-ready', ({ config }) => {
            window.__chatConfig = config;

            // Babel transforms the JSX template after CDNs are loaded
            window.__initSoketiChat = function() {
                const { useState, useRef, useCallback, useEffect } = React;

                function ChatScreen() {
                    const { appKey, wsHost, wsPort, wsTls, channel, myName, appId, sendUrl, csrfToken } = window.__chatConfig;

                    const [messages,  setMessages]  = useState([]);
                    const [inputText, setInputText] = useState('');
                    const [connected, setConnected] = useState(false);
                    const [sending,   setSending]   = useState(false);

                    const pusherRef = useRef(null);
                    const bottomRef = useRef(null);
                    const inputRef  = useRef(null);

                    const addSystem = useCallback((text) => {
                        setMessages(prev => [...prev, {
                            id:      `sys-${Date.now()}-${Math.random()}`,
                            type:    'system',
                            content: text,
                        }]);
                    }, []);

                    useEffect(() => {
                        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }, [messages]);

                    useEffect(() => {
                        const portNum = parseInt(wsPort, 10);
                        const pusher = new Pusher(appKey, {
                            cluster:           'mt1',
                            wsHost:            wsHost,
                            wsPort:            wsTls ? undefined : portNum,
                            wssPort:           wsTls ? portNum : undefined,
                            forceTLS:          wsTls,
                            encrypted:         true,
                            disableStats:      true,
                            enabledTransports: ['ws', 'wss'],
                        });

                        pusherRef.current = pusher;

                        pusher.connection.bind('connected',    () => { setConnected(true);  addSystem('Connected to server.'); });
                        pusher.connection.bind('disconnected', () => { setConnected(false); addSystem('Disconnected.'); });
                        pusher.connection.bind('error',        () => { addSystem('Connection error.'); });

                        const ch = pusher.subscribe(channel);
                        ch.bind('pusher:subscription_succeeded', () => addSystem(`You joined #${channel} as ${myName}`));
                        ch.bind('message', (data) => {
                            setMessages(prev => {
                                if (prev.some(m => m.id === data.id)) return prev;
                                return [...prev, {
                                    id:      data.id,
                                    type:    'chat',
                                    sender:  data.sender,
                                    content: data.content,
                                    isMine:  data.sender === myName,
                                    ts:      new Date().toLocaleTimeString(),
                                }];
                            });
                        });

                        return () => pusher.disconnect();
                    }, []); // eslint-disable-line react-hooks/exhaustive-deps

                    const handleSend = useCallback(async () => {
                        const text = inputText.trim();
                        if (!text || sending || !connected) return;

                        const msgId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

                        setMessages(prev => [...prev, {
                            id:     msgId, type: 'chat', sender: myName,
                            content: text, isMine: true, ts: new Date().toLocaleTimeString(),
                        }]);
                        setInputText('');
                        setSending(true);

                        try {
                            const res = await fetch(sendUrl, {
                                method:  'POST',
                                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken },
                                body:    JSON.stringify({ application_id: appId, channel, data: { id: msgId, sender: myName, content: text } }),
                            });
                            if (!res.ok) addSystem(`Send failed (${res.status}): ${await res.text()}`);
                        } catch (err) {
                            addSystem(`Send error: ${err.message}`);
                        } finally {
                            setSending(false);
                            inputRef.current?.focus();
                        }
                    }, [inputText, sending, connected]);

                    const handleKeyDown = useCallback((e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }, [handleSend]);

                    const handleLeave = useCallback(() => {
                        pusherRef.current?.disconnect();
                        window.__chatRoot = null;
                        document.getElementById('livewire-leave-btn')?.click();
                    }, []);

                    const s = (obj) => obj; // passthrough — styles are plain objects

                    return React.createElement('div', { style: { display:'flex', flexDirection:'column', height:'100%', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }},
                        // Header
                        React.createElement('div', { style: { background:'#009276', color:'#fff', padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }},
                            React.createElement('div', null,
                                React.createElement('div', { style: { fontWeight:700, fontSize:'1.05rem' }}, `#${channel}`),
                                React.createElement('div', { style: { fontSize:'0.78rem', opacity:0.85, marginTop:2 }}, connected ? '● Online' : '○ Connecting…')
                            ),
                            React.createElement('div', { style: { display:'flex', alignItems:'center', gap:10 }},
                                React.createElement('span', { style: { fontSize:'0.82rem', opacity:0.85 }}, 'as ', React.createElement('strong', null, myName)),
                                React.createElement('button', {
                                    onClick: handleLeave,
                                    style: { background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.4)', color:'#fff', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:'0.83rem' }
                                }, 'Leave')
                            )
                        ),
                        // Messages
                        React.createElement('div', { style: { flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:4, background:'#e5ddd5' }},
                            ...messages.map(msg => {
                                if (msg.type === 'system') {
                                    return React.createElement('div', { key: msg.id, style: { display:'flex', justifyContent:'center', margin:'6px 0' }},
                                        React.createElement('div', { style: { background:'rgba(0,0,0,0.07)', color:'#555', fontSize:'0.8rem', borderRadius:12, padding:'5px 16px', textAlign:'center' }}, msg.content)
                                    );
                                }
                                return React.createElement('div', { key: msg.id, style: { display:'flex', flexDirection:'column', alignItems: msg.isMine ? 'flex-end' : 'flex-start' }},
                                    !msg.isMine && React.createElement('div', { style: { fontSize:'0.73rem', fontWeight:700, color:'#009276', padding:'0 12px', marginBottom:2 }}, msg.sender),
                                    React.createElement('div', { style: {
                                        maxWidth:'62%', padding:'9px 13px', fontSize:'0.94rem', lineHeight:1.45, wordBreak:'break-word',
                                        background: msg.isMine ? '#DCF8C6' : '#fff',
                                        borderRadius: msg.isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        color:'#111', boxShadow: msg.isMine ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
                                    }}, msg.content),
                                    React.createElement('div', { style: { fontSize:'0.68rem', color:'#aaa', marginTop:2, padding:'0 4px' }}, msg.ts)
                                );
                            }),
                            React.createElement('div', { ref: bottomRef })
                        ),
                        // Input bar
                        React.createElement('div', { style: { flexShrink:0, background:'#f0f0f0', padding:'10px 14px', display:'flex', gap:10, alignItems:'center', borderTop:'1px solid #ddd' }},
                            React.createElement('input', {
                                ref: inputRef,
                                type: 'text',
                                placeholder: connected ? 'Type a message… (Enter to send)' : 'Waiting for connection…',
                                value: inputText,
                                onChange: e => setInputText(e.target.value),
                                onKeyDown: handleKeyDown,
                                disabled: !connected,
                                autoFocus: true,
                                style: { flex:1, padding:'11px 18px', border:'none', borderRadius:24, fontSize:'0.95rem', background:'#fff', outline:'none', boxShadow:'0 1px 4px rgba(0,0,0,0.08)' }
                            }),
                            React.createElement('button', {
                                onClick: handleSend,
                                disabled: !connected || !inputText.trim() || sending,
                                title: 'Send',
                                style: { background:'#009276', color:'#fff', border:'none', borderRadius:'50%', width:44, height:44, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity:(!connected || !inputText.trim() || sending) ? 0.45 : 1 }
                            },
                                React.createElement('svg', { viewBox:'0 0 24 24', fill:'white', width:20, height:20 },
                                    React.createElement('path', { d:'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' })
                                )
                            )
                        )
                    );
                }

                const container = document.getElementById('soketi-chat-root');
                if (!container) return;
                if (!window.__chatRoot) window.__chatRoot = ReactDOM.createRoot(container);
                window.__chatRoot.render(React.createElement(ChatScreen));
            };

            // CDNs may still be loading — poll until React & Pusher are ready
            const waitAndInit = () => {
                if (typeof React !== 'undefined' && typeof ReactDOM !== 'undefined' && typeof Pusher !== 'undefined') {
                    window.__initSoketiChat();
                } else {
                    setTimeout(waitAndInit, 50);
                }
            };
            waitAndInit();
        });
    </script>
    @endscript

</x-filament-panels::page>
