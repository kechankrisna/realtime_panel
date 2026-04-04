import { useState, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
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
                    <div className="flex items-center gap-2">
                        <Link
                            to="/galleries"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <h1 className="text-xl font-bold">Chess</h1>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {/* VS Machine */}
                        <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                                <Bot className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base">VS Machine</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Play against a minimax AI. No setup required — start instantly.
                                </p>
                            </div>
                            <Button className="mt-auto w-full" onClick={startVsMachine}>
                                Play vs Machine
                            </Button>
                        </div>

                        {/* Create Room */}
                        <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                                <Crown className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base">Create Room</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Host a live match. Share the room code with your opponent.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Soketi Application</Label>
                                <Select value={appId} onValueChange={handleAppChange}>
                                    <SelectTrigger><SelectValue placeholder="Select an app…" /></SelectTrigger>
                                    <SelectContent>
                                        {apps.map((a) => (
                                            <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                className="w-full"
                                disabled={!appId || registerRoom.isPending}
                                onClick={createRoom}
                            >
                                {registerRoom.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Create Room
                            </Button>
                        </div>

                        {/* Join Room */}
                        <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                                <LogIn className="h-6 w-6 text-purple-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base">Join Room</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Enter a code to join an open game waiting for a second player.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Soketi Application</Label>
                                <Select value={appId} onValueChange={handleAppChange}>
                                    <SelectTrigger><SelectValue placeholder="Select an app…" /></SelectTrigger>
                                    <SelectContent>
                                        {apps.map((a) => (
                                            <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Room Code</Label>
                                <Input
                                    placeholder="e.g. A3B2C1"
                                    value={roomInput}
                                    onChange={(e) => { setRoomInput(e.target.value.toUpperCase()); setJoinError(''); }}
                                    maxLength={10}
                                    className="font-mono uppercase tracking-widest"
                                />
                                {joinError && <p className="text-xs text-destructive">{joinError}</p>}
                            </div>
                            <Button
                                className="w-full"
                                disabled={!appId || !roomInput.trim() || claimRoom.isPending}
                                onClick={joinRoom}
                            >
                                {claimRoom.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                Join Game
                            </Button>
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
                        <span className="text-xl font-bold">Chess — Lobby</span>
                    </div>

                    <div className="rounded-xl border bg-card p-8 flex flex-col items-center gap-6 text-center">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Room Code</p>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-4xl font-bold tracking-widest">{roomCode}</span>
                                <Button variant="ghost" size="icon" onClick={copyCode} title="Copy room code">
                                    {copied
                                        ? <Check className="h-4 w-4 text-green-500" />
                                        : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Waiting for opponent…
                        </div>

                        <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                            {connected ? 'Connected to Soketi' : 'Connecting…'}
                        </Badge>

                        <p className="text-xs text-muted-foreground">
                            You are playing as <strong>White</strong>. Share the code above with your opponent.
                        </p>
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
                    <div className="flex items-center gap-2">
                        <Link
                            to="/galleries"
                            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-sm text-muted-foreground">Chess</span>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-sm font-medium">
                            {mode === 'machine' ? 'VS Machine' : 'VS Player'}
                        </span>
                    </div>
                    {mode === 'player' && (
                        <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                            {connected ? 'Connected' : 'Disconnected'}
                        </Badge>
                    )}
                </div>

                {/* Board + Info */}
                <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                    {/* Board */}
                    <div ref={containerRef} className="flex items-start justify-center">
                        <Chessboard
                            boardWidth={boardSize}
                            position={game.fen()}
                            onPieceDrop={onDrop}
                            isDraggablePiece={isDraggablePiece}
                            boardOrientation={mode === 'player' && playerColor === 'b' ? 'black' : 'white'}
                        />
                    </div>

                    {/* Info panel */}
                    <div className="flex flex-col gap-4">
                        {/* Status card */}
                        <div className="rounded-lg border bg-card p-4 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                    {mode === 'machine'
                                        ? 'VS Machine'
                                        : `VS Player · You are ${playerColor === 'w' ? 'White' : 'Black'}`}
                                </Badge>
                                {mode === 'player' && roomCode && (
                                    <Badge variant="outline" className="font-mono text-xs">{roomCode}</Badge>
                                )}
                            </div>
                            <p className={`text-sm font-medium ${isGameOver ? 'text-primary' : ''}`}>
                                {status}
                            </p>
                            {thinking && (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    AI is thinking…
                                </p>
                            )}
                            {mode === 'player' && !opponentJoined && (
                                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Waiting for opponent…
                                </p>
                            )}
                        </div>

                        {/* Move history */}
                        <div className="rounded-lg border bg-card flex-1 overflow-hidden">
                            <div className="px-3 py-2 border-b text-xs font-medium text-muted-foreground">
                                Move History
                            </div>
                            <div className="h-52 overflow-y-auto p-2 space-y-0.5">
                                {movePairs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground text-center pt-6">
                                        No moves yet
                                    </p>
                                ) : (
                                    movePairs.map(({ num, w, b }) => (
                                        <div
                                            key={num}
                                            className="grid grid-cols-[2rem_1fr_1fr] gap-1 text-xs px-1 py-0.5 rounded hover:bg-muted/50"
                                        >
                                            <span className="text-muted-foreground">{num}.</span>
                                            <span>{w}</span>
                                            <span className="text-muted-foreground">{b}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={newGame}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                New Game
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                disabled={isGameOver}
                                onClick={resign}
                            >
                                <Flag className="h-4 w-4 mr-2" />
                                Resign
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
