import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
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
import { ChevronLeft, Bot, LogIn, Users, Copy, Check, RotateCcw, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Rank order: 3=0 ... A=11, 2=12  (2 is highest)
const RANKS = ['3','4','5','6','7','8','9','10','J','Q','K','A','2'];
const SUITS = ['S','C','D','H']; // Spades < Clubs < Diamonds < Hearts
const SUIT_LABEL = { S: '♠', C: '♣', D: '♦', H: '♥' };
const SUIT_COLOR  = { S: 'text-foreground', C: 'text-foreground', D: 'text-red-500', H: 'text-red-500' };

// ---------------------------------------------------------------------------
// Card helpers
// ---------------------------------------------------------------------------

function makeCard(rank, suit) {
    return { rank, suit, id: rank + suit };
}

function cardValue(card) {
    return RANKS.indexOf(card.rank) * 4 + SUITS.indexOf(card.suit);
}

function compareCards(a, b) {
    return cardValue(a) - cardValue(b);
}

function buildDeck() {
    const deck = [];
    for (const rank of RANKS) for (const suit of SUITS) deck.push(makeCard(rank, suit));
    return deck;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function deal() {
    const deck = shuffle(buildDeck());
    return [
        deck.slice(0, 13).sort(compareCards),
        deck.slice(13, 26).sort(compareCards),
        deck.slice(26, 39).sort(compareCards),
        deck.slice(39, 52).sort(compareCards),
    ];
}

// ---------------------------------------------------------------------------
// Play type detection
// ---------------------------------------------------------------------------

function detectPlayType(cards) {
    if (!cards.length) return null;
    const sorted = [...cards].sort(compareCards);
    const n = sorted.length;

    if (n === 1) return { type: 'single', cards: sorted };

    // Check all same rank
    const ranks = sorted.map((c) => c.rank);
    const uniqueRanks = [...new Set(ranks)];

    if (n === 2 && uniqueRanks.length === 1) return { type: 'pair', cards: sorted };
    if (n === 3 && uniqueRanks.length === 1) return { type: 'triple', cards: sorted };
    if (n === 4 && uniqueRanks.length === 1) return { type: 'quad', cards: sorted };

    // Pair sequence: 6,8,10 cards; pairs of consecutive ranks (no 2s)
    if (n >= 6 && n % 2 === 0) {
        const pairs = [];
        let valid = true;
        for (let i = 0; i < n; i += 2) {
            if (sorted[i].rank !== sorted[i + 1].rank) { valid = false; break; }
            pairs.push(sorted[i].rank);
        }
        if (valid) {
            // Check consecutive ranks (no 2s in sequence)
            const rIdxs = pairs.map((r) => RANKS.indexOf(r));
            if (!rIdxs.includes(12)) { // no 2
                let consecutive = true;
                for (let i = 1; i < rIdxs.length; i++) {
                    if (rIdxs[i] !== rIdxs[i - 1] + 1) { consecutive = false; break; }
                }
                if (consecutive) return { type: 'pair-sequence', cards: sorted, pairs };
            }
        }
    }

    // Sequence: 3+ cards, consecutive ranks, no 2s
    if (n >= 3 && uniqueRanks.length === n) {
        const rIdxs = sorted.map((c) => RANKS.indexOf(c.rank));
        if (!rIdxs.includes(12)) { // no 2 in sequences
            let consecutive = true;
            for (let i = 1; i < rIdxs.length; i++) {
                if (rIdxs[i] !== rIdxs[i - 1] + 1) { consecutive = false; break; }
            }
            if (consecutive) return { type: 'sequence', cards: sorted };
        }
    }

    return null; // invalid
}

// ---------------------------------------------------------------------------
// Beats logic
// ---------------------------------------------------------------------------

function highCard(play) {
    return play.cards[play.cards.length - 1]; // sorted ascending, last = highest
}

function canBeat(table, play) {
    if (!table) return true; // fresh lead — anything valid goes

    // Chop rules: quad or 3-pair-sequence beats a single 2
    if (table.type === 'single' && table.cards[0].rank === '2') {
        if (play.type === 'quad') return true;
        if (play.type === 'pair-sequence' && play.pairs && play.pairs.length >= 3) return true;
    }

    // Chop rules: pair of 2s beaten by 4-pair-sequence
    if (table.type === 'pair' && table.cards[0].rank === '2') {
        if (play.type === 'pair-sequence' && play.pairs && play.pairs.length >= 4) return true;
    }

    // Otherwise must be same type, same card count, higher high card
    if (play.type !== table.type) return false;
    if (play.cards.length !== table.cards.length) return false;
    return cardValue(highCard(play)) > cardValue(highCard(table));
}

// ---------------------------------------------------------------------------
// Bot AI — greedy: play cheapest valid combo or pass
// ---------------------------------------------------------------------------

function botMove(hand, table, isFirstTurn) {
    const sorted = [...hand].sort(compareCards);

    // Must play 3♠ on very first turn of the game
    if (isFirstTurn) {
        const threeSpades = sorted.find((c) => c.rank === '3' && c.suit === 'S');
        if (threeSpades) return detectPlayType([threeSpades]);
    }

    // Try singles first (cheapest), then pairs, sequences
    const candidates = [];

    // Singles
    for (const c of sorted) {
        const p = detectPlayType([c]);
        if (p && canBeat(table, p)) candidates.push(p);
    }
    if (!table && candidates.length) return candidates[0];
    if (table && candidates.length) return candidates[0];

    // Pairs
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].rank === sorted[i + 1].rank) {
            const p = detectPlayType([sorted[i], sorted[i + 1]]);
            if (p && canBeat(table, p)) candidates.push(p);
        }
    }

    // Sequences of length 3+
    for (let len = 3; len <= sorted.length; len++) {
        for (let start = 0; start <= sorted.length - len; start++) {
            const slice = sorted.slice(start, start + len);
            const p = detectPlayType(slice);
            if (p && canBeat(table, p)) candidates.push(p);
        }
    }

    // Pick cheapest valid
    for (const c of candidates) {
        if (canBeat(table, c)) return c;
    }

    return null; // pass
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function seatLabel(seatIndex, mySeat, playerNames) {
    if (seatIndex === mySeat) return 'You';
    return playerNames[seatIndex] || `Player ${seatIndex + 1}`;
}

function seatPosition(seatIndex, mySeat) {
    // Returns 'bottom' | 'left' | 'top' | 'right'
    const positions = ['bottom', 'right', 'top', 'left'];
    const offset = (seatIndex - mySeat + 4) % 4;
    return positions[offset];
}

// ---------------------------------------------------------------------------
// Card rendering
// ---------------------------------------------------------------------------

function CardFace({ card, selected, onClick, disabled }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                'relative flex flex-col items-center justify-between rounded-lg border-2 select-none transition-all',
                'w-14 h-20 text-sm font-bold px-1 py-0.5',
                'bg-white dark:bg-zinc-900',
                selected
                    ? 'border-yellow-400 -translate-y-3 shadow-lg shadow-yellow-400/30'
                    : 'border-border hover:border-primary/50 hover:-translate-y-1',
                disabled ? 'opacity-50 cursor-default' : 'cursor-pointer',
            ].join(' ')}
        >
            <span className={`self-start text-xs ${SUIT_COLOR[card.suit]}`}>
                {card.rank}
            </span>
            <span className={`text-xl leading-none ${SUIT_COLOR[card.suit]}`}>
                {SUIT_LABEL[card.suit]}
            </span>
            <span className={`self-end text-xs rotate-180 ${SUIT_COLOR[card.suit]}`}>
                {card.rank}
            </span>
        </button>
    );
}

function CardBack({ tiny = false }) {
    return (
        <div className={[
            'rounded-lg border-2 border-border bg-gradient-to-br from-blue-600 to-blue-900',
            tiny ? 'w-8 h-12' : 'w-14 h-20',
        ].join(' ')} />
    );
}

function TablePile({ play }) {
    if (!play || !play.cards.length) {
        return (
            <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border w-40 h-28 text-xs text-muted-foreground">
                Table empty
            </div>
        );
    }
    return (
        <div className="flex flex-wrap gap-1 justify-center items-end min-h-[5rem]">
            {play.cards.map((c) => (
                <CardFace key={c.id} card={c} selected={false} disabled={true} />
            ))}
        </div>
    );
}

function OpponentHand({ count, label, position }) {
    const isHorizontal = position === 'top';
    const isVertical   = position === 'left' || position === 'right';
    return (
        <div className={`flex flex-col items-center gap-1 ${isVertical ? 'rotate-90' : ''}`}>
            <span className="text-xs text-muted-foreground font-medium">{label} ({count})</span>
            <div className="flex gap-0.5">
                {Array.from({ length: Math.min(count, 8) }).map((_, i) => (
                    <CardBack key={i} tiny />
                ))}
                {count > 8 && <span className="text-xs text-muted-foreground self-center ml-1">+{count - 8}</span>}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TienLenPage() {
    const { user } = useAuth();

    // Screen: 'setup' | 'lobby' | 'game'
    const [screen, setScreen] = useState('setup');

    // Multiplayer
    const [appId, setAppId]       = useState('');
    const [appKey, setAppKey]     = useState('');
    const [roomCode, setRoomCode] = useState('');
    const [roomInput, setRoomInput] = useState('');
    const [seats, setSeats]       = useState(1); // how many seats filled
    const [mySeat, setMySeat]     = useState(0); // 0–3
    const [connected, setConnected] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [copied, setCopied]     = useState(false);
    const echoRef = useRef(null);

    // Game state
    const [hands, setHands]           = useState([[], [], [], []]); // all 4 hands (only mine filled in multiplayer)
    const [table, setTable]           = useState(null);             // last played combo
    const [turn, setTurn]             = useState(0);                // seat index
    const [passCount, setPassCount]   = useState(0);                // consecutive passes since last play
    const [lastPlayer, setLastPlayer] = useState(null);             // seat that played most recently
    const [winners, setWinners]       = useState([]);               // seats in finish order
    const [selected, setSelected]     = useState([]);               // card ids selected in my hand
    const [playerNames, setPlayerNames] = useState(['', '', '', '']);
    const [playError, setPlayError]   = useState('');
    const [isVsBot, setIsVsBot]       = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [firstTurn, setFirstTurn]   = useState(true); // flag for 3♠ enforcement
    const [lastPlay, setLastPlay]     = useState(null); // for display ("Player X played …")

    // Queries
    const { data: appsData } = useQuery({
        queryKey: ['applications-all'],
        queryFn: () => api.get('/applications', { params: { per_page: 999 } }).then((r) => r.data),
    });
    const apps = appsData?.data ?? [];

    const registerRoom = useMutation({ mutationFn: (body) => api.post('/tienlen/rooms', body) });
    const claimRoom    = useMutation({ mutationFn: (body) => api.post('/tienlen/rooms/join', body) });
    const tlTrigger    = useMutation({ mutationFn: (body) => api.post('/tienlen/trigger', body) });

    const handleAppChange = (id) => {
        setAppId(id);
        const found = apps.find((a) => String(a.id) === id);
        setAppKey(found?.key ?? '');
    };

    // ---------------------------------------------------------------------------
    // Echo disconnect on unmount
    // ---------------------------------------------------------------------------
    useEffect(() => () => { echoRef.current?.disconnect(); }, []);

    // ---------------------------------------------------------------------------
    // Bot turn effect — fires whenever turn changes in vs-bot mode
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (!isVsBot || !gameStarted) return;
        if (winners.length >= 3) return; // game over
        if (winners.includes(turn)) {
            // Skip finished players automatically
            advanceTurn(turn, passCount, lastPlayer, table);
            return;
        }
        if (turn === mySeat) return; // human's turn

        const delay = 700 + Math.random() * 600;
        const timer = setTimeout(() => {
            const botHand = hands[turn];
            if (!botHand.length) return;
            const play = botMove(botHand, table, firstTurn && turn === findStartSeat(hands));
            if (play) {
                applyPlay(turn, play);
            } else {
                applyPass(turn);
            }
        }, delay);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [turn, isVsBot, gameStarted, hands, table, winners]);

    // ---------------------------------------------------------------------------
    // Game logic helpers
    // ---------------------------------------------------------------------------

    function findStartSeat(dealtHands) {
        for (let s = 0; s < 4; s++) {
            if (dealtHands[s].find((c) => c.rank === '3' && c.suit === 'S')) return s;
        }
        return 0;
    }

    function advanceTurn(currentTurn, currentPassCount, currentLastPlayer, currentTable) {
        const next = (currentTurn + 1) % 4;
        // Skip winners
        let candidate = next;
        for (let i = 0; i < 4; i++) {
            if (!winners.includes(candidate)) break;
            candidate = (candidate + 1) % 4;
        }

        // If everyone else passed, the last player who played leads fresh
        const activePlayers = [0, 1, 2, 3].filter((s) => !winners.includes(s)).length;
        if (currentPassCount >= activePlayers - 1 && currentLastPlayer !== null) {
            setTable(null);
            setPassCount(0);
            setTurn(currentLastPlayer);
        } else {
            setTurn(candidate);
        }
    }

    function applyPlay(seatIdx, play) {
        const newHands = hands.map((h, i) => {
            if (i !== seatIdx) return h;
            const playIds = new Set(play.cards.map((c) => c.id));
            return h.filter((c) => !playIds.has(c.id));
        });
        setHands(newHands);
        setTable(play);
        setLastPlayer(seatIdx);
        setPassCount(0);
        setFirstTurn(false);
        setSelected([]);
        setPlayError('');
        setLastPlay({ seat: seatIdx, play });

        // Check win
        if (newHands[seatIdx].length === 0) {
            const newWinners = [...winners, seatIdx];
            setWinners(newWinners);
            if (newWinners.length >= 3) return; // game over (4th is loser)
        }

        // Advance turn
        const next = (seatIdx + 1) % 4;
        let candidate = next;
        for (let i = 0; i < 4; i++) {
            if (!winners.includes(candidate)) break;
            candidate = (candidate + 1) % 4;
        }
        setTurn(candidate);
    }

    function applyPass(seatIdx) {
        const newPassCount = passCount + 1;
        setPassCount(newPassCount);
        setLastPlay({ seat: seatIdx, play: null });

        const activePlayers = [0, 1, 2, 3].filter((s) => !winners.includes(s)).length;
        if (newPassCount >= activePlayers - 1 && lastPlayer !== null) {
            setTable(null);
            setPassCount(0);
            setTurn(lastPlayer);
        } else {
            const next = (seatIdx + 1) % 4;
            let candidate = next;
            for (let i = 0; i < 4; i++) {
                if (!winners.includes(candidate)) break;
                candidate = (candidate + 1) % 4;
            }
            setTurn(candidate);
        }
    }

    // ---------------------------------------------------------------------------
    // VS Bots — start immediately
    // ---------------------------------------------------------------------------
    const startVsBots = () => {
        const dealtHands = deal();
        const startSeat  = findStartSeat(dealtHands);
        setIsVsBot(true);
        setMySeat(0);
        setHands(dealtHands);
        setTable(null);
        setTurn(startSeat);
        setPassCount(0);
        setLastPlayer(null);
        setWinners([]);
        setSelected([]);
        setFirstTurn(true);
        setLastPlay(null);
        setGameStarted(true);
        setPlayerNames(['You', 'Bot 1', 'Bot 2', 'Bot 3']);
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
                    setMySeat(0);
                    setSeats(1);
                    setIsVsBot(false);
                    setScreen('lobby');
                    connectEcho(code, appKey, appId, 0);
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
                onSuccess: (data) => {
                    const mySeatIdx = data.seats - 1; // 0-based seat for this joiner
                    setRoomCode(code);
                    setMySeat(mySeatIdx);
                    setSeats(data.seats);
                    setIsVsBot(false);
                    if (data.full) {
                        setScreen('lobby'); // still show lobby until deal event
                    } else {
                        setScreen('lobby');
                    }
                    connectEcho(code, appKey, appId, mySeatIdx);
                    // Announce seat
                    setTimeout(() => {
                        tlTrigger.mutate({
                            application_id: Number(appId),
                            room_code: code,
                            type: 'seat',
                            payload: { seat: mySeatIdx, name: user?.name ?? `Player ${mySeatIdx + 1}` },
                        });
                    }, 300);
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
    // Echo
    // ---------------------------------------------------------------------------
    const connectEcho = useCallback((code, key, aid, mySeatIdx) => {
        if (echoRef.current) {
            echoRef.current.disconnect();
            echoRef.current = null;
        }
        const echo = createEcho({ key });
        echoRef.current = echo;
        const conn = echo.connector.pusher.connection;
        conn.bind('connected', () => {
            setConnected(true);
            // Creator announces themselves
            if (mySeatIdx === 0) {
                setTimeout(() => {
                    tlTrigger.mutate({
                        application_id: Number(aid),
                        room_code: code,
                        type: 'seat',
                        payload: { seat: 0, name: user?.name ?? 'Player 1' },
                    });
                }, 200);
            }
        });
        conn.bind('disconnected', () => setConnected(false));
        conn.bind('failed',       () => setConnected(false));
        conn.bind('unavailable',  () => setConnected(false));

        echo.channel(`tienlen-${code}`).listen('.tienlen-event', handleEchoEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handleEchoEvent = useCallback((e) => {
        if (e.type === 'seat') {
            setPlayerNames((prev) => {
                const n = [...prev];
                n[e.seat] = e.name;
                return n;
            });
            setSeats((prev) => {
                const newSeats = Math.max(prev, e.seat + 1);
                return newSeats;
            });
        } else if (e.type === 'deal') {
            // payload: { hands: [[...], null, null, null], turn, mySeat }
            // Each player only receives their own hand; others are null
            setHands((prev) => {
                const updated = [...prev];
                e.hands.forEach((h, i) => { if (h) updated[i] = h; });
                return updated;
            });
            setTurn(e.turn);
            setTable(null);
            setWinners([]);
            setPassCount(0);
            setLastPlayer(null);
            setFirstTurn(true);
            setLastPlay(null);
            setGameStarted(true);
            setScreen('game');
        } else if (e.type === 'play') {
            applyPlay(e.seat, e.play);
        } else if (e.type === 'pass') {
            applyPass(e.seat);
        } else if (e.type === 'win') {
            setWinners((prev) => [...new Set([...prev, e.seat])]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Creator deals when room fills to 4
    useEffect(() => {
        if (isVsBot || mySeat !== 0 || seats < 4 || gameStarted) return;
        const dealtHands = deal();
        const startSeat  = findStartSeat(dealtHands);
        // Each player's payload only includes their own cards
        const handsPayload = dealtHands.map((h, i) =>
            Array.from({ length: 4 }, (_, seat) => seat === i ? h : null)
        );
        // Broadcast each player's hand separately
        dealtHands.forEach((hand, seat) => {
            const payload = { hands: dealtHands.map((h, i) => i === seat ? h : null), turn: startSeat };
            tlTrigger.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'deal',
                payload,
            });
        });
        // Apply locally for seat 0 (creator)
        setHands(dealtHands);
        setTurn(startSeat);
        setTable(null);
        setWinners([]);
        setPassCount(0);
        setLastPlayer(null);
        setFirstTurn(true);
        setLastPlay(null);
        setGameStarted(true);
        setScreen('game');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seats]);

    // ---------------------------------------------------------------------------
    // Human play / pass
    // ---------------------------------------------------------------------------
    const myHand = hands[mySeat] ?? [];

    const toggleCard = (cardId) => {
        setSelected((prev) =>
            prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
        );
        setPlayError('');
    };

    const handlePlay = () => {
        if (turn !== mySeat) return;
        const playCards = myHand.filter((c) => selected.includes(c.id));
        const play = detectPlayType(playCards);
        if (!play) { setPlayError('Invalid combination.'); return; }

        // First turn: must include 3♠
        if (firstTurn && turn === findStartSeat(hands)) {
            if (!playCards.find((c) => c.rank === '3' && c.suit === 'S')) {
                setPlayError('First play must include 3♠.');
                return;
            }
        }

        if (!canBeat(table, play)) { setPlayError('That doesn\'t beat the table.'); return; }

        if (isVsBot) {
            applyPlay(mySeat, play);
        } else {
            tlTrigger.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'play',
                payload: { seat: mySeat, play },
            });
            applyPlay(mySeat, play);
        }
    };

    const handlePass = () => {
        if (turn !== mySeat) return;
        if (!table) { setPlayError("You must play — it's a fresh lead."); return; }
        if (isVsBot) {
            applyPass(mySeat);
        } else {
            tlTrigger.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'pass',
                payload: { seat: mySeat },
            });
            applyPass(mySeat);
        }
    };

    const handleNewGame = () => {
        echoRef.current?.disconnect();
        echoRef.current = null;
        setConnected(false);
        setScreen('setup');
        setIsVsBot(false);
        setGameStarted(false);
        setHands([[], [], [], []]);
        setTable(null);
        setTurn(0);
        setWinners([]);
        setSelected([]);
        setPassCount(0);
        setLastPlayer(null);
        setFirstTurn(true);
        setLastPlay(null);
        setSeats(1);
        setPlayerNames(['', '', '', '']);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(roomCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isGameOver = winners.length >= 3;
    const validSelectionPlay = selected.length > 0 && (() => {
        const playCards = myHand.filter((c) => selected.includes(c.id));
        const play = detectPlayType(playCards);
        return play && canBeat(table, play);
    })();

    // ---------------------------------------------------------------------------
    // SETUP SCREEN
    // ---------------------------------------------------------------------------
    if (screen === 'setup') {
        return (
            <AppLayout>
                <div className="mx-auto max-w-4xl space-y-6">
                    <div className="flex items-center gap-2">
                        <Link to="/galleries" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <h1 className="text-xl font-bold">Tiến Lên</h1>
                    </div>

                    <p className="text-sm text-muted-foreground max-w-lg">
                        Vietnamese card game. 4 players, 13 cards each. Play singles, pairs, sequences, or combos to empty your hand first. 2 is the highest card — but can be chopped by quads or a 3-pair run.
                    </p>

                    <div className="grid gap-4 md:grid-cols-3">
                        {/* VS Bots */}
                        <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                                <Bot className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base">Play vs Bots</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    You vs 3 bots. No setup needed — start instantly.
                                </p>
                            </div>
                            <Button className="mt-auto w-full" onClick={startVsBots}>
                                Play vs Bots
                            </Button>
                        </div>

                        {/* Create Room */}
                        <div className="rounded-xl border bg-card p-6 flex flex-col gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                                <Users className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-base">Create Room</h2>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Host a 4-player room. Share the code with friends.
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
                            <Button className="w-full" disabled={!appId || registerRoom.isPending} onClick={createRoom}>
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
                                    Enter a code to join an open room (max 4 players).
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
    // LOBBY SCREEN
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
                        <span className="text-xl font-bold">Tiến Lên — Lobby</span>
                    </div>

                    <div className="rounded-xl border bg-card p-8 flex flex-col items-center gap-6 text-center">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Room Code</p>
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-4xl font-bold tracking-widest">{roomCode}</span>
                                <Button variant="ghost" size="icon" onClick={copyCode} title="Copy code">
                                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        {/* Seat indicators */}
                        <div className="flex gap-3">
                            {[0, 1, 2, 3].map((s) => (
                                <div key={s} className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                                    s < seats
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border text-muted-foreground'
                                }`}>
                                    {s < seats ? (playerNames[s] || `P${s+1}`).charAt(0).toUpperCase() : '?'}
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {seats}/4 players joined…
                        </div>

                        <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                            {connected ? 'Connected to Soketi' : 'Connecting…'}
                        </Badge>

                        <p className="text-xs text-muted-foreground">
                            You are <strong>Seat {mySeat + 1}</strong>. Game starts automatically when all 4 seats are filled.
                        </p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    // ---------------------------------------------------------------------------
    // GAME SCREEN
    // ---------------------------------------------------------------------------

    const rankOrder = (s) => {
        if (winners.includes(s)) return winners.indexOf(s) + 1;
        return null;
    };

    return (
        <AppLayout>
            <div className="mx-auto max-w-3xl space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Link to="/galleries" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="text-sm font-medium">Tiến Lên — {isVsBot ? 'VS Bots' : `Room ${roomCode}`}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {!isVsBot && (
                            <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                                {connected ? 'Connected' : 'Disconnected'}
                            </Badge>
                        )}
                        <Button variant="outline" size="sm" onClick={handleNewGame}>
                            <RotateCcw className="h-3 w-3 mr-1" />
                            New Game
                        </Button>
                    </div>
                </div>

                {/* Game area */}
                <div className="rounded-xl border bg-card overflow-hidden">
                    {/* Top opponent */}
                    <div className="flex justify-center pt-4 pb-2">
                        {(() => {
                            const s = (mySeat + 2) % 4;
                            return (
                                <div className={`flex flex-col items-center gap-1 ${turn === s && !isGameOver ? 'ring-2 ring-primary rounded-lg p-1' : ''}`}>
                                    <OpponentHand
                                        count={hands[s].length}
                                        label={rankOrder(s) ? `${seatLabel(s, mySeat, playerNames)} 🏆 #${rankOrder(s)}` : seatLabel(s, mySeat, playerNames)}
                                        position="top"
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {/* Middle row: left | table | right */}
                    <div className="grid grid-cols-[160px_1fr_160px] items-center gap-2 px-2 py-2">
                        {/* Left opponent */}
                        {(() => {
                            const s = (mySeat + 3) % 4;
                            return (
                                <div className={`flex justify-center ${turn === s && !isGameOver ? 'ring-2 ring-primary rounded-lg p-1' : ''}`}>
                                    <OpponentHand
                                        count={hands[s].length}
                                        label={rankOrder(s) ? `${seatLabel(s, mySeat, playerNames)} 🏆 #${rankOrder(s)}` : seatLabel(s, mySeat, playerNames)}
                                        position="left"
                                    />
                                </div>
                            );
                        })()}

                        {/* Table center */}
                        <div className="flex flex-col items-center gap-3">
                            {/* Last action log */}
                            {lastPlay && (
                                <p className="text-xs text-muted-foreground text-center min-h-[1rem]">
                                    {lastPlay.play
                                        ? `${seatLabel(lastPlay.seat, mySeat, playerNames)} played ${lastPlay.play.type} (${lastPlay.play.cards.map((c) => c.rank + SUIT_LABEL[c.suit]).join(' ')})`
                                        : `${seatLabel(lastPlay.seat, mySeat, playerNames)} passed`}
                                </p>
                            )}
                            <TablePile play={table} />
                            {/* Turn indicator */}
                            <p className={`text-xs font-medium ${isGameOver ? 'text-green-500' : 'text-primary'}`}>
                                {isGameOver
                                    ? `Game over! Winner: ${seatLabel(winners[0], mySeat, playerNames)}`
                                    : turn === mySeat
                                        ? '🟢 Your turn'
                                        : `⏳ ${seatLabel(turn, mySeat, playerNames)}'s turn`}
                            </p>
                        </div>

                        {/* Right opponent */}
                        {(() => {
                            const s = (mySeat + 1) % 4;
                            return (
                                <div className={`flex justify-center ${turn === s && !isGameOver ? 'ring-2 ring-primary rounded-lg p-1' : ''}`}>
                                    <OpponentHand
                                        count={hands[s].length}
                                        label={rankOrder(s) ? `${seatLabel(s, mySeat, playerNames)} 🏆 #${rankOrder(s)}` : seatLabel(s, mySeat, playerNames)}
                                        position="right"
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {/* My hand */}
                    <div className="border-t bg-muted/20 px-4 pt-4 pb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium text-muted-foreground">
                                Your hand ({myHand.length} cards)
                                {rankOrder(mySeat) && ` 🏆 #${rankOrder(mySeat)}`}
                            </span>
                            {selected.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    {selected.length} selected
                                </span>
                            )}
                        </div>

                        {/* Cards */}
                        <div className="flex flex-wrap gap-1.5 justify-center min-h-[5rem]">
                            {myHand.map((card) => (
                                <CardFace
                                    key={card.id}
                                    card={card}
                                    selected={selected.includes(card.id)}
                                    onClick={() => toggleCard(card.id)}
                                    disabled={turn !== mySeat || isGameOver || winners.includes(mySeat)}
                                />
                            ))}
                            {myHand.length === 0 && (
                                <p className="text-sm text-muted-foreground self-center">
                                    {winners.includes(mySeat) ? '✅ You finished!' : 'Waiting for cards…'}
                                </p>
                            )}
                        </div>

                        {/* Action bar */}
                        <div className="mt-4 flex items-center justify-center gap-3">
                            {playError && (
                                <p className="text-xs text-destructive absolute">{playError}</p>
                            )}
                            <Button
                                onClick={handlePlay}
                                disabled={turn !== mySeat || selected.length === 0 || isGameOver || winners.includes(mySeat)}
                                className="w-28"
                            >
                                Play
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handlePass}
                                disabled={turn !== mySeat || !table || isGameOver || winners.includes(mySeat)}
                                className="w-28"
                            >
                                Pass
                            </Button>
                        </div>
                        {playError && (
                            <p className="text-xs text-destructive text-center mt-2">{playError}</p>
                        )}
                    </div>
                </div>

                {/* Score summary when game over */}
                {isGameOver && (
                    <div className="rounded-xl border bg-card p-4">
                        <h3 className="font-semibold text-sm mb-3">Final Rankings</h3>
                        <div className="space-y-1">
                            {winners.map((s, idx) => (
                                <div key={s} className="flex items-center gap-2 text-sm">
                                    <span className="font-bold">#{idx + 1}</span>
                                    <span>{seatLabel(s, mySeat, playerNames)}</span>
                                    {idx === 0 && <span className="text-yellow-500">👑 Winner</span>}
                                </div>
                            ))}
                            {/* Loser: the one not in winners */}
                            {[0, 1, 2, 3].filter((s) => !winners.includes(s)).map((s) => (
                                <div key={s} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="font-bold">#4</span>
                                    <span>{seatLabel(s, mySeat, playerNames)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
