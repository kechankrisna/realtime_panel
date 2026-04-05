import { useState, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createEcho } from '@/lib/echo';
import { ChevronLeft, Bot, LogIn, Crown, Copy, Check, RotateCcw, Flag, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// AI — piece values + piece-square tables (White's perspective, idx 0 = a8)
// ---------------------------------------------------------------------------

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

const PST = {
    p: [
         0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
         5,  5, 10, 25, 25, 10,  5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5, -5,-10,  0,  0,-10, -5,  5,
         5, 10, 10,-20,-20, 10, 10,  5,
         0,  0,  0,  0,  0,  0,  0,  0,
    ],
    n: [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50,
    ],
    b: [
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5, 10, 10,  5,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20,
    ],
    r: [
         0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0,
    ],
    q: [
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
         -5,  0,  5,  5,  5,  5,  0, -5,
          0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20,
    ],
    k: [
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
         20, 20,  0,  0,  0,  0, 20, 20,
         20, 30, 10,  0,  0, 10, 30, 20,
    ],
};

function evaluate(game) {
    if (game.isCheckmate()) return game.turn() === 'w' ? -99999 : 99999;
    if (game.isDraw()) return 0;
    const board = game.board();
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;
            const idx = piece.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;
            const val = PIECE_VALUES[piece.type] + (PST[piece.type]?.[idx] ?? 0);
            score += piece.color === 'w' ? val : -val;
        }
    }
    return score;
}

function minimax(game, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || game.isGameOver()) return evaluate(game);
    const moves = game.moves();
    if (isMaximizing) {
        let best = -Infinity;
        for (const m of moves) {
            game.move(m);
            best = Math.max(best, minimax(game, depth - 1, alpha, beta, false));
            game.undo();
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const m of moves) {
            game.move(m);
            best = Math.min(best, minimax(game, depth - 1, alpha, beta, true));
            game.undo();
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return best;
    }
}

function getBestMove(game) {
    // AI plays Black — minimize the score
    const moves = game.moves({ verbose: true });
    if (!moves.length) return null;
    // Shuffle for variety when positions are equal
    for (let i = moves.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [moves[i], moves[j]] = [moves[j], moves[i]];
    }
    let bestMove = null;
    let bestScore = Infinity;
    for (const m of moves) {
        game.move(m.san);
        const score = minimax(game, 2, -Infinity, Infinity, true);
        game.undo();
        if (score < bestScore) {
            bestScore = score;
            bestMove = m;
        }
    }
    return bestMove;
}

function getStatus(game, resigned) {
    if (resigned) return `${resigned === 'w' ? 'White' : 'Black'} resigned — ${resigned === 'w' ? 'Black' : 'White'} wins!`;
    if (game.isCheckmate()) return `Checkmate — ${game.turn() === 'w' ? 'Black' : 'White'} wins!`;
    if (game.isStalemate()) return 'Stalemate — draw!';
    if (game.isThreefoldRepetition()) return 'Draw by threefold repetition!';
    if (game.isInsufficientMaterial()) return 'Draw by insufficient material!';
    if (game.isDraw()) return 'Draw!';
    if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check!`;
    return `${game.turn() === 'w' ? 'White' : 'Black'} to move`;
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChessPage() {
    const { user } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Navigation: 'setup' | 'lobby' | 'game'
    const [screen, setScreen] = useState('setup');
    const [mode, setMode] = useState(null); // 'machine' | 'player'

    // Game state
    const [game, setGame] = useState(() => new Chess());
    const [thinking, setThinking] = useState(false);
    const [resigned, setResigned] = useState(null); // 'w' | 'b'

    // Multiplayer state
    const [appId, setAppId] = useState('');
    const [appKey, setAppKey] = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [playerColor, setPlayerColor] = useState('w');
    const [opponentJoined, setOpponentJoined] = useState(false);
    const [connected, setConnected] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [copied, setCopied] = useState(false);

    // Board sizing (responsive)
    const containerRef = useRef(null);
    const [boardSize, setBoardSize] = useState(480);
    const echoRef = useRef(null);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                setBoardSize(Math.min(containerRef.current.clientWidth, 520));
            }
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Disconnect Echo on unmount
    useEffect(() => () => { echoRef.current?.disconnect(); }, []);

    const { data: appsData } = useQuery({
        queryKey: ['applications-all'],
        queryFn: () => api.get('/applications', { params: { per_page: 999 } }).then((r) => r.data),
    });
    const apps = appsData?.data ?? [];

    const registerRoom = useMutation({ mutationFn: (body) => api.post('/chess/rooms', body) });
    const claimRoom    = useMutation({ mutationFn: (body) => api.post('/chess/rooms/join', body) });
    const chessMove    = useMutation({ mutationFn: (body) => api.post('/chess/trigger', body) });

    const handleAppChange = (id) => {
        setAppId(id);
        const found = apps.find((a) => String(a.id) === id);
        setAppKey(found?.key ?? '');
    };

    // ---------------------------------------------------------------------------
    // Echo event handler — only uses stable setState calls
    // ---------------------------------------------------------------------------
    const handleEchoEvent = (e) => {
        if (e.type === 'join') {
            setOpponentJoined(true);
            setScreen('game');
            setGame(new Chess());
            setResigned(null);
        } else if (e.type === 'move') {
            setGame((prev) => {
                const next = new Chess(prev.fen());
                try {
                    next.move({ from: e.from, to: e.to, promotion: e.promotion || 'q' });
                    return next;
                } catch {
                    return prev;
                }
            });
        } else if (e.type === 'resign') {
            setResigned(e.color);
        }
    };

    // ---------------------------------------------------------------------------
    // Connect Echo to a room channel
    // ---------------------------------------------------------------------------
    const connectToRoom = (code, isJoiner, currentAppKey, currentAppId) => {
        if (echoRef.current) {
            echoRef.current.disconnect();
            echoRef.current = null;
        }
        const echo = createEcho({ key: currentAppKey });
        echoRef.current = echo;
        const conn = echo.connector.pusher.connection;
        conn.bind('connected', () => {
            setConnected(true);
            if (isJoiner) {
                setTimeout(() => {
                    chessMove.mutate({
                        application_id: Number(currentAppId),
                        room_code: code,
                        type: 'join',
                        payload: { player: user?.name ?? 'Opponent' },
                    });
                }, 300);
            }
        });
        conn.bind('disconnected', () => setConnected(false));
        conn.bind('failed', () => setConnected(false));
        conn.bind('unavailable', () => setConnected(false));
        echo.channel(`chess-${code}`).listen('.chess-event', handleEchoEvent);
    };

    // ---------------------------------------------------------------------------
    // VS Machine
    // ---------------------------------------------------------------------------
    const startVsMachine = () => {
        setMode('machine');
        setGame(new Chess());
        setResigned(null);
        setThinking(false);
        setScreen('game');
    };

    // ---------------------------------------------------------------------------
    // Create room
    // ---------------------------------------------------------------------------
    const createRoom = () => {
        const code = generateRoomCode();
        registerRoom.mutate(
            { application_id: Number(appId), room_code: code },
            {
                onSuccess: () => {
                    setRoomCode(code);
                    setPlayerColor('w');
                    setOpponentJoined(false);
                    setMode('player');
                    setGame(new Chess());
                    setResigned(null);
                    setScreen('lobby');
                    connectToRoom(code, false, appKey, appId);
                },
            }
        );
    };

    // ---------------------------------------------------------------------------
    // Join room
    // ---------------------------------------------------------------------------
    const joinRoom = () => {
        const code = roomInput.trim().toUpperCase();
        if (!code) return;
        setJoinError('');
        claimRoom.mutate(
            { application_id: Number(appId), room_code: code },
            {
                onSuccess: () => {
                    setRoomCode(code);
                    setPlayerColor('b');
                    setOpponentJoined(true);
                    setMode('player');
                    setGame(new Chess());
                    setResigned(null);
                    setScreen('game');
                    connectToRoom(code, true, appKey, appId);
                },
                onError: (err) => {
                    const status = err?.response?.status;
                    if (status === 404) setJoinError('Room not found. Check the code.');
                    else if (status === 409) setJoinError('Room is full or the game has already started.');
                    else if (status === 422) setJoinError('Wrong Soketi application for this room.');
                    else setJoinError('Failed to join. Please try again.');
                },
            }
        );
    };

    // ---------------------------------------------------------------------------
    // Chess board interactions
    // ---------------------------------------------------------------------------
    const onDrop = (from, to) => {
        if (game.isGameOver() || resigned || thinking) return false;
        if (mode === 'machine' && game.turn() !== 'w') return false;
        if (mode === 'player' && (game.turn() !== playerColor || !opponentJoined)) return false;

        const updated = new Chess(game.fen());
        try {
            updated.move({ from, to, promotion: 'q' });
        } catch {
            return false;
        }

        setGame(updated);

        if (mode === 'player') {
            chessMove.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'move',
                payload: { from, to, promotion: 'q', fen: updated.fen() },
            });
        } else if (mode === 'machine' && !updated.isGameOver()) {
            setThinking(true);
            setTimeout(() => {
                const scratch = new Chess(updated.fen());
                const best = getBestMove(scratch);
                if (best) {
                    const next = new Chess(updated.fen());
                    next.move({ from: best.from, to: best.to, promotion: best.promotion || 'q' });
                    setGame(next);
                }
                setThinking(false);
            }, 150 + Math.random() * 250);
        }

        return true;
    };

    const isDraggablePiece = ({ piece }) => {
        if (game.isGameOver() || resigned || thinking) return false;
        if (mode === 'machine') return piece[0] === 'w' && game.turn() === 'w';
        if (mode === 'player') return piece[0] === playerColor && game.turn() === playerColor && opponentJoined;
        return false;
    };

    const resign = () => {
        const color = mode === 'machine' ? 'w' : playerColor;
        setResigned(color);
        if (mode === 'player') {
            chessMove.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'resign',
                payload: { color },
            });
        }
    };

    const newGame = () => {
        setGame(new Chess());
        setResigned(null);
        setThinking(false);
        if (mode === 'player') {
            echoRef.current?.disconnect();
            echoRef.current = null;
            setConnected(false);
            setOpponentJoined(false);
        }
        setMode(null);
        setScreen('setup');
    };

    const copyCode = () => {
        navigator.clipboard.writeText(roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Move history pairs
    const history = game.history();
    const movePairs = [];
    for (let i = 0; i < history.length; i += 2) {
        movePairs.push({ num: i / 2 + 1, w: history[i], b: history[i + 1] ?? '' });
    }

    const isGameOver = game.isGameOver() || !!resigned;
    const status = getStatus(game, resigned);

    // ---------------------------------------------------------------------------
    // Setup screen
    // ---------------------------------------------------------------------------
    if (screen === 'setup') {
        return (
            <AppLayout>
                <div className="mx-auto max-w-4xl space-y-6">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2">
                        <Link
                            to="/galleries"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <h1 className="text-xl font-bold text-yellow-500">Chess</h1>
                    </div>

                    {/* Casino hero banner */}
                    <div className="relative overflow-hidden rounded-2xl border dark:border-yellow-900/30 border-yellow-700/30 px-6 py-5"
                        style={{ background: isDark
                            ? 'radial-gradient(ellipse at 30% 50%, #2a1a00 0%, #0d0900 80%)'
                            : 'radial-gradient(ellipse at 30% 50%, #fdf6e3 0%, #edd98a 80%)' }}>
                        <div className="absolute inset-0 flex items-center justify-around pointer-events-none select-none opacity-[0.05] text-9xl text-yellow-300 font-serif">
                            <span>♛</span><span>♜</span><span>♝</span><span>♞</span>
                        </div>
                        <p className="relative text-sm dark:text-yellow-200/50 text-yellow-900/60 max-w-xl leading-relaxed">
                            Classical chess — minimax AI or live multiplayer via Soketi.{' '}
                            <span className="dark:text-yellow-400/80 text-yellow-700 font-semibold">Drag pieces</span> to make your move. Resign anytime.
                        </p>
                    </div>

                    {/* Mode cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* VS Machine */}
                        <div className="rounded-2xl border dark:border-yellow-900/25 border-yellow-700/25 bg-gradient-to-b dark:from-stone-950 dark:to-zinc-950 from-amber-50 to-stone-50 p-6 flex flex-col gap-4 transition-all hover:border-yellow-700/40 hover:shadow-lg hover:shadow-yellow-950/20">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 border border-green-500/20">
                                <Bot className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-base dark:text-white text-stone-900">VS Machine</h2>
                                <p className="text-sm dark:text-yellow-200/30 text-stone-500 mt-1">Play against a minimax AI. No setup required — start instantly.</p>
                            </div>
                            <button
                                onClick={startVsMachine}
                                className="mt-auto w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95
                                    bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950
                                    shadow-md shadow-yellow-600/20 hover:from-yellow-300 hover:to-yellow-500"
                            >
                                Play Now
                            </button>
                        </div>

                        {/* Create Room */}
                        <div className="rounded-2xl border dark:border-yellow-900/25 border-yellow-700/25 bg-gradient-to-b dark:from-stone-950 dark:to-zinc-950 from-amber-50 to-stone-50 p-6 flex flex-col gap-4 transition-all hover:border-yellow-700/40 hover:shadow-lg hover:shadow-yellow-950/20">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <Crown className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-base dark:text-white text-stone-900">Create Room</h2>
                                <p className="text-sm dark:text-yellow-200/30 text-stone-500 mt-1">Host a live match. Share the room code with your opponent.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs dark:text-yellow-300/50 text-yellow-700">Soketi Application</Label>
                                <Select value={appId} onValueChange={handleAppChange}>
                                    <SelectTrigger className="dark:bg-black/30 bg-white dark:border-yellow-900/30 border-amber-300/60 dark:text-yellow-100 text-stone-800 text-sm">
                                        <SelectValue placeholder="Select an app…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {apps.map((a) => (
                                            <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <button
                                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95
                                    bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950
                                    shadow-md shadow-yellow-600/20 hover:from-yellow-300 hover:to-yellow-500
                                    disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                                    flex items-center justify-center gap-2"
                                disabled={!appId || registerRoom.isPending}
                                onClick={createRoom}
                            >
                                {registerRoom.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Create Room
                            </button>
                        </div>

                        {/* Join Room */}
                        <div className="rounded-2xl border dark:border-yellow-900/25 border-yellow-700/25 bg-gradient-to-b dark:from-stone-950 dark:to-zinc-950 from-amber-50 to-stone-50 p-6 flex flex-col gap-4 transition-all hover:border-yellow-700/40 hover:shadow-lg hover:shadow-yellow-950/20">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <LogIn className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-base dark:text-white text-stone-900">Join Room</h2>
                                <p className="text-sm dark:text-yellow-200/30 text-stone-500 mt-1">Enter a code to join an open game waiting for a second player.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs dark:text-yellow-300/50 text-yellow-700">Soketi Application</Label>
                                <Select value={appId} onValueChange={handleAppChange}>
                                    <SelectTrigger className="dark:bg-black/30 bg-white dark:border-yellow-900/30 border-amber-300/60 dark:text-yellow-100 text-stone-800 text-sm">
                                        <SelectValue placeholder="Select an app…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {apps.map((a) => (
                                            <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs dark:text-yellow-300/50 text-yellow-700">Room Code</Label>
                                <Input
                                    placeholder="e.g. A3B2C1"
                                    value={roomInput}
                                    onChange={(e) => { setRoomInput(e.target.value.toUpperCase()); setJoinError(''); }}
                                    maxLength={10}
                                    className="font-mono uppercase tracking-widest dark:bg-black/30 bg-white dark:border-yellow-900/30 border-amber-300/60 dark:text-yellow-100 text-stone-800"
                                />
                                {joinError && <p className="text-xs text-red-400">{joinError}</p>}
                            </div>
                            <button
                                className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95
                                    bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950
                                    shadow-md shadow-yellow-600/20 hover:from-yellow-300 hover:to-yellow-500
                                    disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                                    flex items-center justify-center gap-2"
                                disabled={!appId || !roomInput.trim() || claimRoom.isPending}
                                onClick={joinRoom}
                            >
                                {claimRoom.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Join Game
                            </button>
                        </div>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ---------------------------------------------------------------------------
    // Lobby screen — creator waiting for opponent
    // ---------------------------------------------------------------------------
    if (screen === 'lobby') {
        return (
            <AppLayout>
                <div className="mx-auto max-w-sm space-y-6">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                echoRef.current?.disconnect();
                                echoRef.current = null;
                                setConnected(false);
                                setScreen('setup');
                            }}
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </button>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-xl font-bold text-yellow-500">Chess — Lobby</span>
                    </div>

                    <div className="rounded-2xl border border-yellow-900/40 overflow-hidden"
                        style={{ background: 'radial-gradient(ellipse at center, #2a1a00 0%, #090600 90%)' }}>
                        <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/60 to-yellow-700/0" />
                        <div className="p-8 flex flex-col items-center gap-6 text-center">
                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold text-yellow-600/60 uppercase tracking-[0.3em]">Room Code</p>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-4xl font-black tracking-widest text-yellow-300">{roomCode}</span>
                                    <button
                                        onClick={copyCode}
                                        className="p-1.5 rounded-lg bg-black/40 border border-yellow-600/20 text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-500/40 transition-all"
                                        title="Copy room code"
                                    >
                                        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-yellow-600/50">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Waiting for opponent…
                            </div>

                            <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                                {connected ? 'Connected to Soketi' : 'Connecting…'}
                            </Badge>

                            <p className="text-xs text-yellow-600/40">
                                You are playing as <strong className="text-yellow-300/70">White ♙</strong>. Share the code above with your opponent.
                            </p>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/60 to-yellow-700/0" />
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ---------------------------------------------------------------------------
    // Game screen
    // ---------------------------------------------------------------------------
    return (
        <AppLayout>
            <div className="mx-auto max-w-5xl space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Link
                            to="/galleries"
                            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="font-semibold text-yellow-500">Chess</span>
                        <span className="text-muted-foreground/40">—</span>
                        <span className="text-muted-foreground">{mode === 'machine' ? 'VS Machine' : 'VS Player'}</span>
                    </div>
                    {mode === 'player' && (
                        <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                            {connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                    )}
                </div>

                {/* Board + Info */}
                <div className="grid gap-5 md:grid-cols-[1fr_272px]">
                    {/* Board — casino dark wood frame */}
                    <div ref={containerRef} className="flex items-start justify-center">
                        <div className="rounded-xl overflow-hidden"
                            style={{
                                padding: 10,
                                background: isDark
                                    ? 'linear-gradient(145deg, #3b2300 0%, #1e1200 50%, #2e1a00 100%)'
                                    : 'linear-gradient(145deg, #c8a030 0%, #8b5e15 50%, #a07020 100%)',
                                boxShadow: isDark
                                    ? '0 25px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(202,163,90,0.25), inset 0 1px 0 rgba(255,220,100,0.1)'
                                    : '0 15px 40px rgba(100,60,0,0.3), 0 0 0 1px rgba(202,163,90,0.5), inset 0 1px 0 rgba(255,220,100,0.3)',
                            }}
                        >
                            <Chessboard
                                boardWidth={boardSize}
                                position={game.fen()}
                                onPieceDrop={onDrop}
                                isDraggablePiece={isDraggablePiece}
                                boardOrientation={mode === 'player' && playerColor === 'b' ? 'black' : 'white'}
                                customBoardStyle={{
                                    borderRadius: 4,
                                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
                                }}
                                customDarkSquareStyle={{ backgroundColor: '#b58863' }}
                                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
                                customDropSquareStyle={{ boxShadow: 'inset 0 0 1px 4px rgba(202,163,90,0.8)' }}
                            />
                        </div>
                    </div>

                    {/* Info panel */}
                    <div className="flex flex-col gap-3">
                        {/* Status card */}
                        <div className="rounded-2xl border dark:border-yellow-900/30 border-yellow-700/30 overflow-hidden"
                            style={{ background: isDark
                                ? 'linear-gradient(160deg, #1c1100 0%, #0a0800 100%)'
                                : 'linear-gradient(160deg, #fef9ec 0%, #fdf1d0 100%)' }}>
                            <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/40 to-yellow-700/0" />
                            <div className="p-4 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-bold dark:text-yellow-600/50 text-yellow-700/60 uppercase tracking-widest">
                                        {mode === 'machine' ? 'VS Machine' : `VS Player · ${playerColor === 'w' ? 'White ♙' : 'Black ♟'}`}
                                    </span>
                                    {mode === 'player' && roomCode && (
                                        <span className="font-mono text-[10px] dark:text-yellow-700/60 text-yellow-600/80 border dark:border-yellow-900/30 border-yellow-600/30 rounded px-1.5 py-0.5">{roomCode}</span>
                                    )}
                                </div>
                                <p className={`text-sm font-semibold leading-snug ${isGameOver ? 'dark:text-yellow-400 text-yellow-600' : 'dark:text-yellow-100/90 text-stone-800'}`}>
                                    {status}
                                </p>
                                {thinking && (
                                    <p className="flex items-center gap-1.5 text-xs dark:text-yellow-600/50 text-stone-500">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        AI is thinking…
                                    </p>
                                )}
                                {mode === 'player' && !opponentJoined && (
                                    <p className="flex items-center gap-1.5 text-xs dark:text-yellow-600/50 text-stone-500">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Waiting for opponent…
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Move history */}
                        <div className="rounded-2xl border dark:border-yellow-900/30 border-yellow-700/30 flex-1 overflow-hidden flex flex-col"
                            style={{ background: isDark
                                ? 'linear-gradient(160deg, #141005 0%, #080600 100%)'
                                : 'linear-gradient(160deg, #fef9ec 0%, #f9f0d8 100%)' }}>
                            <div className="px-4 py-2.5 border-b dark:border-yellow-900/20 border-yellow-700/20 flex items-center gap-2">
                                <span className="text-[10px] font-bold dark:text-yellow-600/50 text-yellow-700/60 uppercase tracking-[0.2em]">Move History</span>
                            </div>
                            <div className="h-52 overflow-y-auto px-2 py-2 space-y-0.5 scrollbar-thin">
                                {movePairs.length === 0 ? (
                                    <p className="text-xs dark:text-yellow-900/60 text-stone-400 text-center pt-6 select-none">No moves yet</p>
                                ) : (
                                    movePairs.map(({ num, w, b }) => (
                                        <div
                                            key={num}
                                            className="grid grid-cols-[2rem_1fr_1fr] gap-1 text-xs px-2 py-1 rounded-lg hover:bg-yellow-900/10 transition-colors"
                                        >
                                            <span className="dark:text-yellow-800/60 text-stone-400 font-medium">{num}.</span>
                                            <span className="dark:text-yellow-100/80 text-stone-700 font-mono">{w}</span>
                                            <span className="dark:text-yellow-200/40 text-stone-400 font-mono">{b}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={newGame}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95
                                    bg-transparent border dark:border-yellow-900/40 border-yellow-700/40 dark:text-yellow-500/70 text-yellow-600
                                    dark:hover:bg-yellow-900/20 hover:bg-yellow-50 dark:hover:border-yellow-700/50 hover:border-yellow-600/50 dark:hover:text-yellow-400 hover:text-yellow-700"
                            >
                                <RotateCcw className="h-4 w-4" />
                                New Game
                            </button>
                            <button
                                onClick={resign}
                                disabled={isGameOver}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95
                                    bg-transparent border dark:border-red-900/40 border-red-700/40 dark:text-red-500/60 text-red-600/70
                                    dark:hover:bg-red-900/20 hover:bg-red-50 dark:hover:border-red-700/50 hover:border-red-500/50 dark:hover:text-red-400 hover:text-red-600
                                    disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                                <Flag className="h-4 w-4" />
                                Resign
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
