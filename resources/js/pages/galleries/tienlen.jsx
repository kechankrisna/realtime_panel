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
// Card rendering helpers
// ---------------------------------------------------------------------------

function cardRotationDeg(cardId) {
    let h = 0;
    for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) & 0xffff;
    return ((h % 60) - 30) / 10; // -3 to +3 degrees, deterministic per card
}

function CardFace({ card, selected, onClick, disabled }) {
    const isRed = card.suit === 'D' || card.suit === 'H';
    const clr = isRed ? 'text-red-600' : 'text-slate-900';
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={[
                'relative flex flex-col justify-between rounded-xl select-none transition-all duration-150',
                'w-16 h-24 px-1.5 py-1.5 bg-white shadow-md',
                selected
                    ? '-translate-y-5 shadow-2xl ring-2 ring-yellow-400 border border-yellow-400 shadow-yellow-400/40'
                    : disabled
                        ? 'opacity-60 cursor-default border border-gray-200'
                        : 'cursor-pointer border border-gray-200 hover:-translate-y-2 hover:shadow-xl hover:border-yellow-300',
            ].join(' ')}
        >
            <div className={`flex flex-col items-start leading-none ${clr}`}>
                <span className="text-[11px] font-black leading-tight">{card.rank}</span>
                <span className="text-[11px] leading-tight">{SUIT_LABEL[card.suit]}</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className={`text-3xl opacity-10 select-none ${clr}`}>{SUIT_LABEL[card.suit]}</span>
            </div>
            <div className={`flex flex-col items-end leading-none rotate-180 ${clr}`}>
                <span className="text-[11px] font-black leading-tight">{card.rank}</span>
                <span className="text-[11px] leading-tight">{SUIT_LABEL[card.suit]}</span>
            </div>
        </button>
    );
}

function CardBack({ tiny = false }) {
    return (
        <div className={[
            'rounded-lg border border-red-900/60 bg-gradient-to-br from-red-700 to-red-950',
            'ring-1 ring-inset ring-yellow-600/20 flex items-center justify-center shadow-md overflow-hidden',
            tiny ? 'w-8 h-12' : 'w-16 h-24',
        ].join(' ')}>
            <div className={`grid grid-cols-3 gap-0.5 opacity-20 text-yellow-300 select-none leading-none ${tiny ? 'text-[5px]' : 'text-[8px]'}`}>
                {['♦','♣','♠','♥','♦','♣','♠','♥','♦'].map((s, i) => (
                    <span key={i} className="text-center">{s}</span>
                ))}
            </div>
        </div>
    );
}

function TablePile({ play }) {
    if (!play || !play.cards.length) {
        return (
            <div className="flex items-center justify-center w-48 h-32 rounded-[40%] border-2 border-dashed border-emerald-500/25 bg-emerald-800/10">
                <div className="text-center space-y-1 select-none">
                    <div className="text-emerald-500/20 text-lg leading-none tracking-wider">♠ ♣ ♦ ♥</div>
                    <div className="text-[10px] text-emerald-500/30 uppercase tracking-[0.2em]">Table</div>
                </div>
            </div>
        );
    }
    return (
        <div className="flex flex-wrap gap-1 justify-center items-end min-h-[8rem] min-w-[12rem] max-w-[22rem] rounded-3xl p-3 bg-emerald-800/20 border border-emerald-600/20">
            {play.cards.map((c) => (
                <div key={c.id} style={{ transform: `rotate(${cardRotationDeg(c.id)}deg)` }}>
                    <CardFace card={c} selected={false} disabled={true} />
                </div>
            ))}
        </div>
    );
}

function OpponentHand({ count, label, position, isActive }) {
    const isVert = position === 'left' || position === 'right';
    const visible = Math.min(count, 10);
    const extra = Math.max(0, count - 10);
    const OVERLAP = 11;
    const CARD_W = 32;
    const fanWidth = visible > 0 ? (visible - 1) * OVERLAP + CARD_W : CARD_W;
    return (
        <div className={`flex flex-col items-center gap-2 ${isVert ? 'rotate-90' : ''}`}>
            <div className={`rounded-full px-3 py-0.5 border flex items-center gap-1.5 transition-all ${
                isActive
                    ? 'bg-yellow-400/10 border-yellow-400/50 shadow-sm shadow-yellow-400/20'
                    : 'bg-black/40 border-yellow-600/15'
            }`}>
                <span className={`text-xs font-semibold ${isActive ? 'text-yellow-300' : 'text-emerald-200/80'}`}>{label}</span>
                {count > 0 && <span className={`text-xs ${isActive ? 'text-yellow-400/80' : 'text-emerald-500/60'}`}>({count})</span>}
            </div>
            {count > 0 ? (
                <div className="relative" style={{ width: fanWidth, height: 48 }}>
                    {Array.from({ length: visible }).map((_, i) => {
                        const mid = (visible - 1) / 2;
                        const angle = ((i - mid) * 3).toFixed(1);
                        const yOff = Math.abs(i - mid) * 1.5;
                        return (
                            <div
                                key={i}
                                style={{
                                    position: 'absolute',
                                    left: i * OVERLAP,
                                    top: yOff,
                                    zIndex: i,
                                    transform: `rotate(${angle}deg)`,
                                    transformOrigin: 'bottom center',
                                }}
                            >
                                <CardBack tiny />
                            </div>
                        );
                    })}
                    {extra > 0 && (
                        <span className="absolute -right-7 top-1 text-xs text-emerald-400/70 font-medium">+{extra}</span>
                    )}
                </div>
            ) : (
                <span className="text-xs text-emerald-500/40 italic px-2">finished</span>
            )}
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
    const [maxPlayers, setMaxPlayers] = useState(4); // human seats (2|3|4)
    const [connected, setConnected] = useState(false);
    const [joinError, setJoinError] = useState('');
    const [copied, setCopied]     = useState(false);
    const echoRef = useRef(null);
    const echoEventHandlerRef = useRef(null);
    const socketIdRef = useRef(null);

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

    // Derived: seat indices that will be filled by bots
    const botSeats = Array.from({ length: 4 - maxPlayers }, (_, i) => maxPlayers + i);
    const [firstTurn, setFirstTurn]   = useState(true); // flag for 3♠ enforcement
    const [lastPlay, setLastPlay]     = useState(null); // for display ("Player X played …")

    // Queries
    const { data: appsData } = useQuery({
        queryKey: ['applications-all'],
        queryFn: () => api.get('/applications', { params: { per_page: 999 } }).then((r) => r.data),
    });
    const apps = appsData?.data ?? [];

    const registerRoom = useMutation({ mutationFn: (body) => api.post('/tienlen/rooms', body) });
    const claimRoom    = useMutation({ mutationFn: (body) => api.post('/tienlen/rooms/join', body).then((r) => r.data) });
    const tlTrigger    = useMutation({ mutationFn: (body) => api.post('/tienlen/trigger', { ...body, socket_id: socketIdRef.current }) });

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
    // Bot turn effect — multiplayer mode, creator drives bot seats via WebSocket
    // ---------------------------------------------------------------------------
    useEffect(() => {
        if (isVsBot || !gameStarted || mySeat !== 0) return;
        if (botSeats.length === 0 || !botSeats.includes(turn)) return;
        if (winners.includes(turn)) return;

        const startSeat = findStartSeat(hands);
        const delay = 700 + Math.random() * 600;
        const timer = setTimeout(() => {
            const botHand = hands[turn];
            if (!botHand || !botHand.length) return;
            const play = botMove(botHand, table, firstTurn && turn === startSeat);
            if (play) {
                tlTrigger.mutate({
                    application_id: Number(appId),
                    room_code: roomCode,
                    type: 'play',
                    payload: { seat: turn, play },
                });
                applyPlay(turn, play);
            } else {
                tlTrigger.mutate({
                    application_id: Number(appId),
                    room_code: roomCode,
                    type: 'pass',
                    payload: { seat: turn },
                });
                applyPass(turn);
            }
        }, delay);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [turn, isVsBot, gameStarted, mySeat, maxPlayers, hands, table, winners, firstTurn]);

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
        const prevHandSize = hands[seatIdx]?.length ?? 0;
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

        // Only check win if we actually had this seat's hand (prevHandSize > 0).
        // In multiplayer, non-local seats have hands=[] — we must not trigger a
        // false win when removing cards from an empty array.
        if (prevHandSize > 0 && newHands[seatIdx].length === 0) {
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
            { application_id: Number(appId), room_code: code, max_players: maxPlayers },
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
                    setMaxPlayers(data.max_players ?? 4);
                    setIsVsBot(false);
                    if (data.full) {
                        setScreen('lobby'); // still show lobby until deal event
                    } else {
                        setScreen('lobby');
                    }
                    connectEcho(code, appKey, appId, mySeatIdx);
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
            socketIdRef.current = echo.connector.pusher.connection.socket_id;
            setConnected(true);
            // All players announce their seat once the WS connection is established
            setTimeout(() => {
                tlTrigger.mutate({
                    application_id: Number(aid),
                    room_code: code,
                    type: 'seat',
                    payload: { seat: mySeatIdx, name: user?.name ?? `Player ${mySeatIdx + 1}` },
                });
            }, 200);
        });
        conn.bind('disconnected', () => setConnected(false));
        conn.bind('failed',       () => setConnected(false));
        conn.bind('unavailable',  () => setConnected(false));

        echo.channel(`tienlen-${code}`).listen('.tienlen-event', handleEchoEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Re-assigned on every render so applyPlay/applyPass always have fresh state.
    // The stable handleEchoEvent callback delegates here to avoid stale closures.
    echoEventHandlerRef.current = (e) => {
        if (e.type === 'seat') {
            setPlayerNames((prev) => {
                const n = [...prev];
                n[e.seat] = e.name;
                return n;
            });
            setSeats((prev) => Math.max(prev, e.seat + 1));
        } else if (e.type === 'deal') {
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
    };

    const handleEchoEvent = useCallback((e) => {
        echoEventHandlerRef.current?.(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Creator deals when human seats fill up; bots backfill the rest
    useEffect(() => {
        if (isVsBot || mySeat !== 0 || seats < maxPlayers || gameStarted) return;
        const dealtHands = deal();
        const startSeat  = findStartSeat(dealtHands);
        // Announce bot seats so all players see their names
        botSeats.forEach((s, i) => {
            tlTrigger.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'seat',
                payload: { seat: s, name: `Bot ${i + 1}` },
            });
        });
        // Broadcast each human player's hand separately (bots are local-only)
        dealtHands.slice(0, maxPlayers).forEach((_hand, humanIdx) => {
            const payload = { hands: dealtHands.map((h, i) => i === humanIdx ? h : null), turn: startSeat };
            tlTrigger.mutate({
                application_id: Number(appId),
                room_code: roomCode,
                type: 'deal',
                payload,
            });
        });
        // Apply ALL 4 hands locally — creator drives bot turns
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
    }, [seats, maxPlayers]);

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
        setMaxPlayers(4);
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
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2">
                        <Link to="/galleries" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <h1 className="text-xl font-bold text-yellow-500">Tiến Lên</h1>
                    </div>

                    {/* Casino hero banner */}
                    <div className="relative overflow-hidden rounded-2xl border border-emerald-800/40 px-6 py-5"
                        style={{ background: 'radial-gradient(ellipse at 30% 50%, #1a5c3a 0%, #082218 80%)' }}>
                        <div className="absolute inset-0 flex items-center justify-around pointer-events-none select-none opacity-[0.04] text-9xl text-yellow-300 font-serif">
                            <span>♠</span><span>♣</span><span>♦</span><span>♥</span>
                        </div>
                        <p className="relative text-sm text-emerald-200/70 max-w-xl leading-relaxed">
                            Vietnamese card game — 4 players, 13 cards each. Play singles, pairs, sequences, or combos to empty your hand first.{' '}
                            <span className="text-yellow-400/90 font-semibold">2 is the highest card</span>, but can be chopped by quads or a 3-pair run.
                        </p>
                    </div>

                    {/* Mode cards */}
                    <div className="grid gap-4 md:grid-cols-3">
                        {/* VS Bots */}
                        <div className="rounded-2xl border border-emerald-800/30 bg-gradient-to-b from-emerald-950/80 to-zinc-950 p-6 flex flex-col gap-4 transition-all hover:border-emerald-600/50 hover:shadow-lg hover:shadow-emerald-950/30">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <Bot className="h-6 w-6 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-base text-white">Play vs Bots</h2>
                                <p className="text-sm text-emerald-300/50 mt-1">You vs 3 bots. No setup needed — start instantly.</p>
                            </div>
                            <button
                                onClick={startVsBots}
                                className="mt-auto w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95
                                    bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950
                                    shadow-md shadow-yellow-600/20 hover:from-yellow-300 hover:to-yellow-500"
                            >
                                Play Now
                            </button>
                        </div>

                        {/* Create Room */}
                        <div className="rounded-2xl border border-emerald-800/30 bg-gradient-to-b from-emerald-950/80 to-zinc-950 p-6 flex flex-col gap-4 transition-all hover:border-emerald-600/50 hover:shadow-lg hover:shadow-emerald-950/30">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <Users className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-base text-white">Create Room</h2>
                                <p className="text-sm text-emerald-300/50 mt-1">Host a room and invite friends. Bots fill any empty seats.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-emerald-300/60">Soketi Application</Label>
                                <Select value={appId} onValueChange={handleAppChange}>
                                    <SelectTrigger className="bg-black/30 border-emerald-700/30 text-emerald-100 text-sm">
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
                                <Label className="text-xs text-emerald-300/60">Human Players</Label>
                                <Select value={String(maxPlayers)} onValueChange={(v) => setMaxPlayers(Number(v))}>
                                    <SelectTrigger className="bg-black/30 border-emerald-700/30 text-emerald-100 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="2">2 humans + 2 bots</SelectItem>
                                        <SelectItem value="3">3 humans + 1 bot</SelectItem>
                                        <SelectItem value="4">4 humans (no bots)</SelectItem>
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
                        <div className="rounded-2xl border border-emerald-800/30 bg-gradient-to-b from-emerald-950/80 to-zinc-950 p-6 flex flex-col gap-4 transition-all hover:border-emerald-600/50 hover:shadow-lg hover:shadow-emerald-950/30">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <LogIn className="h-6 w-6 text-purple-400" />
                            </div>
                            <div>
                                <h2 className="font-bold text-base text-white">Join Room</h2>
                                <p className="text-sm text-emerald-300/50 mt-1">Enter a code to join an open room. Bots fill remaining seats.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-emerald-300/60">Soketi Application</Label>
                                <Select value={appId} onValueChange={handleAppChange}>
                                    <SelectTrigger className="bg-black/30 border-emerald-700/30 text-emerald-100 text-sm">
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
                                <Label className="text-xs text-emerald-300/60">Room Code</Label>
                                <Input
                                    placeholder="e.g. A3B2C1"
                                    value={roomInput}
                                    onChange={(e) => { setRoomInput(e.target.value.toUpperCase()); setJoinError(''); }}
                                    maxLength={10}
                                    className="font-mono uppercase tracking-widest bg-black/30 border-emerald-700/30 text-emerald-100"
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
                        <span className="text-xl font-bold text-yellow-500">Tiến Lên — Lobby</span>
                    </div>

                    <div className="rounded-2xl border border-emerald-800/40 overflow-hidden"
                        style={{ background: 'radial-gradient(ellipse at center, #1a5c3a 0%, #082218 90%)' }}>
                        <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/60 to-yellow-700/0" />
                        <div className="p-8 flex flex-col items-center gap-6 text-center">
                            <div className="space-y-1">
                                <p className="text-[10px] font-semibold text-emerald-400/60 uppercase tracking-[0.3em]">Room Code</p>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-4xl font-black tracking-widest text-yellow-300">{roomCode}</span>
                                    <button
                                        onClick={copyCode}
                                        className="p-1.5 rounded-lg bg-black/30 border border-yellow-600/20 text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-500/40 transition-all"
                                        title="Copy code"
                                    >
                                        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Seat indicators */}
                            <div className="flex gap-3">
                                {[0, 1, 2, 3].map((s) => {
                                    const isBot = s >= maxPlayers;
                                    const isFilled = s < seats;
                                    return (
                                        <div key={s} className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                                            isFilled
                                                ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300 shadow-md shadow-yellow-500/20'
                                                : isBot
                                                    ? 'border-emerald-700/40 bg-emerald-900/30 text-emerald-500'
                                                    : 'border-emerald-800/50 text-emerald-700'
                                        }`}>
                                            {isFilled ? (playerNames[s] || `P${s + 1}`).charAt(0).toUpperCase() : isBot ? '🤖' : '?'}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center gap-2 text-sm text-emerald-400/60">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {seats}/{maxPlayers} players joined…
                            </div>

                            <Badge variant={connected ? 'success' : 'secondary'} className="text-xs">
                                {connected ? 'Connected to Soketi' : 'Connecting…'}
                            </Badge>

                            <p className="text-xs text-emerald-400/50">
                                You are <strong className="text-emerald-300/80">Seat {mySeat + 1}</strong>. Game starts when all {maxPlayers} human seats fill up
                                {botSeats.length > 0 && <> — <span className="text-emerald-400/70">{botSeats.length} bot{botSeats.length > 1 ? 's' : ''} will join automatically</span></>}.
                            </p>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/60 to-yellow-700/0" />
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
                    <div className="flex items-center gap-2 text-sm">
                        <Link to="/galleries" className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="h-4 w-4" />
                            Galleries
                        </Link>
                        <span className="text-muted-foreground/40">/</span>
                        <span className="font-semibold text-yellow-500">Tiến Lên</span>
                        <span className="text-muted-foreground/40">—</span>
                        <span className="text-sm text-muted-foreground">{isVsBot ? 'VS Bots' : `Room ${roomCode}`}</span>
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

                {/* Casino table */}
                <div className="rounded-2xl overflow-hidden border border-emerald-900/60 shadow-2xl" style={{ background: '#071a10' }}>
                    {/* Top gold accent stripe */}
                    <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/40 to-yellow-700/0" />

                    {/* Felt playing area */}
                    <div className="px-4 py-5"
                        style={{ background: 'radial-gradient(ellipse 80% 90% at 50% 40%, #1b6b3a 0%, #0e4224 45%, #06200f 100%)' }}>

                        {/* Top opponent */}
                        <div className="flex justify-center mb-3">
                            {(() => {
                                const s = (mySeat + 2) % 4;
                                const active = turn === s && !isGameOver;
                                return (
                                    <div className={`rounded-2xl px-3 py-2 transition-all duration-300 ${active ? 'ring-1 ring-yellow-400/60 bg-yellow-400/5' : ''}`}>
                                        <OpponentHand
                                            count={hands[s].length}
                                            label={rankOrder(s) ? `${seatLabel(s, mySeat, playerNames)} #${rankOrder(s)}` : seatLabel(s, mySeat, playerNames)}
                                            position="top"
                                            isActive={active}
                                        />
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Middle: left | center | right */}
                        <div className="grid grid-cols-[150px_1fr_150px] items-center gap-2">
                            {/* Left opponent */}
                            {(() => {
                                const s = (mySeat + 3) % 4;
                                const active = turn === s && !isGameOver;
                                return (
                                    <div className={`flex justify-center rounded-2xl px-2 py-2 transition-all duration-300 ${active ? 'ring-1 ring-yellow-400/60 bg-yellow-400/5' : ''}`}>
                                        <OpponentHand
                                            count={hands[s].length}
                                            label={rankOrder(s) ? `${seatLabel(s, mySeat, playerNames)} #${rankOrder(s)}` : seatLabel(s, mySeat, playerNames)}
                                            position="left"
                                            isActive={active}
                                        />
                                    </div>
                                );
                            })()}

                            {/* Center table */}
                            <div className="flex flex-col items-center gap-2">
                                {lastPlay && (
                                    <p className="text-[10px] text-emerald-300/50 text-center h-4 truncate max-w-[180px]">
                                        {lastPlay.play
                                            ? `${seatLabel(lastPlay.seat, mySeat, playerNames)}: ${lastPlay.play.cards.map((c) => c.rank + SUIT_LABEL[c.suit]).join(' ')}`
                                            : `${seatLabel(lastPlay.seat, mySeat, playerNames)} passed`}
                                    </p>
                                )}
                                <TablePile play={table} />
                                <p className={`text-[11px] font-bold tracking-widest uppercase mt-1 transition-colors duration-300 ${
                                    isGameOver
                                        ? 'text-yellow-400'
                                        : turn === mySeat
                                            ? 'text-green-400'
                                            : 'text-emerald-500/60'
                                }`}>
                                    {isGameOver
                                        ? `🏆 ${seatLabel(winners[0], mySeat, playerNames)} wins`
                                        : turn === mySeat
                                            ? '● Your turn'
                                            : `⏳ ${seatLabel(turn, mySeat, playerNames)}`}
                                </p>
                            </div>

                            {/* Right opponent */}
                            {(() => {
                                const s = (mySeat + 1) % 4;
                                const active = turn === s && !isGameOver;
                                return (
                                    <div className={`flex justify-center rounded-2xl px-2 py-2 transition-all duration-300 ${active ? 'ring-1 ring-yellow-400/60 bg-yellow-400/5' : ''}`}>
                                        <OpponentHand
                                            count={hands[s].length}
                                            label={rankOrder(s) ? `${seatLabel(s, mySeat, playerNames)} #${rankOrder(s)}` : seatLabel(s, mySeat, playerNames)}
                                            position="right"
                                            isActive={active}
                                        />
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Bottom gold accent stripe */}
                    <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/40 to-yellow-700/0" />

                    {/* My hand section */}
                    <div className="bg-zinc-950 px-4 pt-4 pb-6">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold text-yellow-500/70 uppercase tracking-widest">
                                Your Hand ({myHand.length})
                                {rankOrder(mySeat) ? ` · Rank #${rankOrder(mySeat)}` : ''}
                            </span>
                            {selected.length > 0 && (
                                <span className="text-xs text-emerald-400/60">{selected.length} selected</span>
                            )}
                        </div>

                        {/* Cards */}
                        <div className="flex flex-wrap gap-1.5 justify-center min-h-[6rem]">
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
                                <div className="flex items-center justify-center w-full">
                                    <span className="text-sm text-emerald-600/50">
                                        {winners.includes(mySeat) ? '✅ You finished!' : 'Waiting for cards…'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Action bar */}
                        <div className="mt-5 flex items-center justify-center gap-3">
                            <button
                                onClick={handlePlay}
                                disabled={turn !== mySeat || selected.length === 0 || isGameOver || winners.includes(mySeat)}
                                className="w-28 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95
                                    bg-gradient-to-b from-yellow-400 to-yellow-600 text-yellow-950
                                    shadow-lg shadow-yellow-700/30 hover:from-yellow-300 hover:to-yellow-500 hover:shadow-yellow-600/40
                                    disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                Play
                            </button>
                            <button
                                onClick={handlePass}
                                disabled={turn !== mySeat || !table || isGameOver || winners.includes(mySeat)}
                                className="w-28 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95
                                    bg-transparent border border-emerald-700/50 text-emerald-400
                                    hover:bg-emerald-900/40 hover:border-emerald-600
                                    disabled:opacity-25 disabled:cursor-not-allowed"
                            >
                                Pass
                            </button>
                        </div>
                        {playError && (
                            <p className="text-xs text-red-400 text-center mt-2 font-medium">{playError}</p>
                        )}
                    </div>
                </div>

                {/* Game over rankings */}
                {isGameOver && (
                    <div className="rounded-2xl border border-yellow-600/20 overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #1c1100 0%, #0a1a0a 100%)' }}>
                        <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/50 to-yellow-700/0" />
                        <div className="p-5">
                            <h3 className="font-black text-yellow-500 tracking-[0.15em] uppercase text-xs mb-4 flex items-center gap-2">
                                <span>🏆</span> Final Rankings
                            </h3>
                            <div className="space-y-2">
                                {winners.map((s, idx) => (
                                    <div key={s} className="flex items-center gap-3">
                                        <span className={`text-sm font-black w-7 ${
                                            idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : 'text-amber-700'
                                        }`}>#{idx + 1}</span>
                                        <span className={`text-sm ${idx === 0 ? 'text-yellow-200 font-bold' : 'text-emerald-200/80'}`}>
                                            {seatLabel(s, mySeat, playerNames)}
                                        </span>
                                        {idx === 0 && <span className="ml-auto text-xs text-yellow-400 font-bold tracking-wide">👑 WINNER</span>}
                                    </div>
                                ))}
                                {[0, 1, 2, 3].filter((s) => !winners.includes(s)).map((s) => (
                                    <div key={s} className="flex items-center gap-3">
                                        <span className="text-sm font-black w-7 text-red-600/50">#4</span>
                                        <span className="text-sm text-emerald-600/40">{seatLabel(s, mySeat, playerNames)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="h-0.5 bg-gradient-to-r from-yellow-700/0 via-yellow-500/50 to-yellow-700/0" />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
