import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

const appVersion = document.querySelector('meta[name="app-version"]')?.content ?? '1.0.0';

export function AppLayout({ children }) {
    const [pinned, setPinned] = useState(false);

    return (
        <div className="flex min-h-screen">
            {/* ── Liquid Glass ambient orbs ── */}
            <div className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden">
                <div className="animate-blob absolute -left-64 -top-64 h-[650px] w-[650px] rounded-full bg-primary/30 blur-[120px] dark:bg-primary/20" />
                <div className="animate-blob animation-delay-7 absolute -right-48 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-500/25 blur-[100px] dark:bg-indigo-500/15" />
                <div className="animate-blob animation-delay-12 absolute -bottom-48 left-1/2 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-violet-500/20 blur-[100px] dark:bg-violet-500/10" />
                <div className="animate-blob animation-delay-3 absolute right-1/4 top-1/2 h-[320px] w-[320px] rounded-full bg-cyan-400/15 blur-[80px] dark:bg-cyan-400/10" />
            </div>
            <Sidebar pinned={pinned} onPinToggle={() => setPinned((p) => !p)} />
            <div className={cn(
                'flex flex-1 flex-col transition-[padding] duration-200 ease-in-out',
                'pt-14 sm:pt-0',
                pinned ? 'sm:pl-52' : 'sm:pl-16'
            )}>
                <main className="flex-1">
                    <div className="mx-auto max-w-screen-xl px-4 py-6">
                        {children}
                    </div>
                </main>
                <footer className="border-t glass">
                    <div className="mx-auto flex max-w-screen-xl flex-col items-center justify-between gap-2 px-4 py-3 sm:flex-row">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">RealtimePanel</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span>v{appVersion}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <Link to="/documentation/client" className="hover:text-foreground transition-colors">Docs</Link>
                            <a
                                href="https://docs.soketi.app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                            >
                                Soketi Docs ↗
                            </a>
                            <a
                                href="https://github.com/kechankrisna/realtimepanel"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-foreground transition-colors"
                            >
                                GitHub ↗
                            </a>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}

