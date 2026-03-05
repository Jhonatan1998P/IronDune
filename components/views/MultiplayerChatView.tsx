
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMultiplayerChat } from '../../hooks/useMultiplayerChat';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useP2PGiftResource } from '../../hooks/useP2PGiftResource';
import { GameState } from '../../types';
import { GlassButton, Icons } from '../UIComponents';
import { MultiplayerMenu } from '../UI/MultiplayerMenu';
import { Send, Users, MessageSquare, Shield, Gift, Droplets, Coins, Crosshair, AtSign } from 'lucide-react';

interface MultiplayerChatViewProps {
    gameState: GameState;
}

type GiftableResource = 'OIL' | 'GOLD' | 'AMMO';

const RESOURCE_META: Record<GiftableResource, { label: string; color: string; bg: string; border: string; Icon: React.FC<{ className?: string }> }> = {
    OIL:  { label: 'Petróleo', color: 'text-yellow-400',  bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  Icon: ({ className }) => <Droplets className={className} /> },
    GOLD: { label: 'Oro',      color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   Icon: ({ className }) => <Coins className={className} /> },
    AMMO: { label: 'Munición', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     Icon: ({ className }) => <Crosshair className={className} /> },
};

const fmt = (n: number) => Math.floor(n).toLocaleString();

// Formats milliseconds to "Xh Ym" string
const fmtMs = (ms: number): string => {
    const totalMin = Math.ceil(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
};

export const MultiplayerChatView: React.FC<MultiplayerChatViewProps> = ({ gameState }) => {
    const { messages, sendMessage, isConnected } = useMultiplayerChat();
    const { currentRoomId, remotePlayers, peers, isConnecting } = useMultiplayer();
    const { sendResource, getRemainingLimit, getTotalCap, getAlreadySent, getMsUntilReset } = useP2PGiftResource();

    const [inputText, setInputText] = useState('');
    const [showMenu, setShowMenu] = useState(false);
    const [showGiftPanel, setShowGiftPanel] = useState(false);
    const [sendError, setSendError] = useState<string | null>(null);
    const [sendSuccess, setSendSuccess] = useState<string | null>(null);

    // @mention autocomplete state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([]);
    const [selectedSuggestion, setSelectedSuggestion] = useState(0);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Clear feedback after 3s
    useEffect(() => {
        if (sendError || sendSuccess) {
            const t = setTimeout(() => { setSendError(null); setSendSuccess(null); }, 3000);
            return () => clearTimeout(t);
        }
        return undefined;
    }, [sendError, sendSuccess]);

    // Detect @mention in input and build suggestions
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputText(val);

        // Find if there's an active @mention being typed (after last space or start)
        const cursorPos = e.target.selectionStart ?? val.length;
        const textUpToCursor = val.slice(0, cursorPos);
        const mentionMatch = textUpToCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            const query = mentionMatch[1].toLowerCase();
            setMentionQuery(query);
            const allNames = remotePlayers.map(p => p.name).filter(Boolean);
            const filtered = query
                ? allNames.filter(n => n.toLowerCase().startsWith(query))
                : allNames;
            setMentionSuggestions(filtered.slice(0, 5));
            setSelectedSuggestion(0);
        } else {
            setMentionQuery(null);
            setMentionSuggestions([]);
        }
    };

    const completeMention = (name: string) => {
        if (!inputRef.current) return;
        const cursorPos = inputRef.current.selectionStart ?? inputText.length;
        const textUpToCursor = inputText.slice(0, cursorPos);
        const mentionStart = textUpToCursor.lastIndexOf('@');
        const newText = inputText.slice(0, mentionStart) + '@' + name + ' ' + inputText.slice(cursorPos);
        setInputText(newText);
        setMentionQuery(null);
        setMentionSuggestions([]);
        // Move cursor after the inserted name
        setTimeout(() => {
            if (inputRef.current) {
                const newPos = mentionStart + name.length + 2; // @name + space
                inputRef.current.focus();
                inputRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (mentionSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedSuggestion(prev => (prev + 1) % mentionSuggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedSuggestion(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                if (mentionSuggestions[selectedSuggestion]) {
                    e.preventDefault();
                    completeMention(mentionSuggestions[selectedSuggestion]);
                    return;
                }
            }
            if (e.key === 'Escape') {
                setMentionQuery(null);
                setMentionSuggestions([]);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            handleSendMessage();
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !isConnected) return;
        // Close any open mention dropdown before sending
        setMentionQuery(null);
        setMentionSuggestions([]);
        sendMessage(inputText, gameState.playerName);
        setInputText('');
    };

    const handleSendResource = (resource: GiftableResource, fraction: number) => {
        const remaining = getRemainingLimit(resource);
        const amount = Math.floor(remaining * fraction);
        if (amount <= 0) {
            setSendError('No tienes recursos disponibles para enviar');
            return;
        }
        const result = sendResource(resource, amount);
        if (result.success) {
            setSendSuccess(`Enviaste ${fmt(amount)} ${RESOURCE_META[resource].label.toLowerCase()} a todos`);
        } else {
            setSendError(result.reason ?? 'Error al enviar');
        }
    };

    if (!isConnected) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-4 md:p-6 text-center animate-[fadeIn_0.3s_ease-out] overflow-x-hidden">
                <div className="relative mb-4 md:mb-6">
                    <div className="p-4 md:p-6 bg-slate-900/50 rounded-full border border-white/10 shadow-2xl relative z-10">
                        <MessageSquare className="w-8 h-8 md:w-12 md:h-12 text-slate-500" />
                    </div>
                    <div className="absolute -inset-4 bg-cyan-500/10 rounded-full blur-2xl animate-pulse" />
                </div>
                
                <h2 className="font-tech text-lg md:text-xl text-white uppercase tracking-widest mb-2">
                    {isConnecting ? 'Conectando...' : 'Chat Multijugador'}
                </h2>
                <p className="text-slate-400 text-xs md:text-sm max-w-xs mb-6 md:mb-8">
                    {isConnecting 
                        ? 'Estableciendo conexión con la red P2P. Por favor espera.'
                        : 'Únete a una sala para chatear en tiempo real con otros comandantes.'}
                </p>

                {!isConnecting && (
                    <GlassButton 
                        onClick={() => setShowMenu(true)}
                        variant="primary"
                        className="px-6 md:px-8 py-2 md:py-3 text-xs md:text-sm"
                    >
                        Abrir Menú Multijugador
                    </GlassButton>
                )}

                {showMenu && <MultiplayerMenu onClose={() => setShowMenu(false)} />}
            </div>
        );
    }

    const msUntilReset = getMsUntilReset();
    const showMentionDropdown = mentionSuggestions.length > 0 && mentionQuery !== null;

    return (
        <div className="h-full w-full flex flex-col gap-2 animate-[fadeIn_0.3s_ease-out] overflow-x-hidden overflow-y-hidden">
            {/* Header Area */}
            <div className="shrink-0 flex items-center justify-between gap-2 bg-slate-950/40 px-2 py-1.5 md:p-3 rounded-lg md:rounded-xl border border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                        <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] text-cyan-500/70 uppercase tracking-widest font-bold leading-none mb-0.5">Sala Activa</div>
                        <div className="text-[10px] font-mono text-cyan-300 truncate max-w-[120px] sm:max-w-none">{currentRoomId}</div>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <div className="text-[9px] text-slate-500 uppercase font-bold whitespace-nowrap">{peers.length + 1} online</div>
                    {/* Gift panel toggle */}
                    <button
                        onClick={() => setShowGiftPanel(v => !v)}
                        className={`p-1.5 rounded-lg border transition-colors ${showGiftPanel ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'hover:bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        title="Enviar recursos"
                    >
                        <Gift className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={() => setShowMenu(true)}
                        className="p-1.5 hover:bg-white/5 rounded-lg border border-white/10 transition-colors text-slate-400 hover:text-white"
                    >
                        <Icons.Settings className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Gift Panel */}
            {showGiftPanel && (
                <div className="shrink-0 bg-slate-950/60 border border-white/10 rounded-xl p-2.5 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                            <Gift className="w-3 h-3" /> Enviar Recursos (a todos)
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                            Reset en {fmtMs(msUntilReset)}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                        {(Object.keys(RESOURCE_META) as GiftableResource[]).map(res => {
                            const meta = RESOURCE_META[res];
                            const cap = getTotalCap(res);
                            const remaining = getRemainingLimit(res);
                            const sent = getAlreadySent(res);
                            const pctSent = cap > 0 ? Math.min(1, sent / cap) : 0;

                            return (
                                <div key={res} className={`rounded-lg border ${meta.border} ${meta.bg} p-1.5 flex flex-col gap-1`}>
                                    {/* Resource header */}
                                    <div className="flex items-center gap-1">
                                        <meta.Icon className={`w-3 h-3 ${meta.color} shrink-0`} />
                                        <span className={`text-[9px] font-bold uppercase ${meta.color} truncate`}>{meta.label}</span>
                                        <span className="ml-auto text-[8px] text-slate-500 font-mono shrink-0">{fmt(cap)}</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-0.5 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${pctSent >= 1 ? 'bg-red-500' : meta.color.replace('text-', 'bg-')}`}
                                            style={{ width: `${pctSent * 100}%` }}
                                        />
                                    </div>

                                    {/* Sent / remaining */}
                                    <div className="flex justify-between text-[7px] text-slate-500 font-mono">
                                        <span>+{fmt(sent)}</span>
                                        <span className={remaining > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            {fmt(remaining)} dis.
                                        </span>
                                    </div>

                                    {/* Send buttons */}
                                    {remaining > 0 ? (
                                        <div className="flex gap-0.5 mt-0.5">
                                            {([0.25, 0.5, 1] as const).map(frac => (
                                                <button
                                                    key={frac}
                                                    onClick={() => handleSendResource(res, frac)}
                                                    className={`flex-1 text-[8px] font-bold py-0.5 rounded border transition-all ${meta.border} ${meta.bg} ${meta.color} hover:opacity-80 active:scale-95`}
                                                >
                                                    {frac === 1 ? 'MAX' : `${frac * 100}%`}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[7px] text-red-400/80 text-center py-0.5">Límite diario</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Feedback */}
                    {(sendError || sendSuccess) && (
                        <div className={`mt-2 text-[9px] font-bold text-center py-1 px-2 rounded ${sendSuccess ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                            {sendSuccess ?? sendError}
                        </div>
                    )}
                </div>
            )}

            {/* Main Chat Area — flex-1 to fill remaining space */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950/20 rounded-xl border border-white/5 relative shadow-inner overflow-hidden">
                {/* Messages List */}
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3 custom-scrollbar"
                >
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                            <MessageSquare className="w-6 md:w-8 h-6 md:h-8 mb-1 md:mb-2" />
                            <p className="text-[10px] md:text-xs uppercase tracking-[0.2em]">No hay mensajes aún</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div 
                                key={msg.id} 
                                className={`flex flex-col ${msg.isLocal ? 'items-end' : 'items-start'}`}
                            >
                                <div className={`flex items-center gap-1 mb-0.5 px-1 ${msg.isLocal ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${msg.isLocal ? 'text-cyan-400' : 'text-amber-400'}`}>
                                        {msg.senderName}
                                    </span>
                                    <span className="text-[7px] md:text-[8px] text-slate-600 font-mono">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className={`
                                    max-w-[88%] px-3 py-2 rounded-xl text-xs md:text-sm relative break-words shadow-lg
                                    ${msg.isLocal 
                                        ? 'bg-cyan-600/20 text-cyan-50 border border-cyan-500/30 rounded-tr-none' 
                                        : 'bg-slate-800/80 text-slate-200 border border-white/5 rounded-tl-none'}
                                `}>
                                    {msg.text}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Status Bar */}
                <div className="shrink-0 px-3 py-1 border-t border-white/5 bg-black/20 flex items-center justify-between text-[8px] text-slate-500 uppercase tracking-tighter">
                    <span className="flex items-center gap-1">
                        <Shield className="w-2 h-2" /> P2P Encriptado
                    </span>
                    <span className="flex items-center gap-1">
                        {remotePlayers.length > 0 ? (
                            <span className="text-emerald-500/70">{remotePlayers.length} aliado{remotePlayers.length !== 1 ? 's' : ''} cerca</span>
                        ) : (
                            'Solo tú en la frecuencia'
                        )}
                    </span>
                </div>
            </div>

            {/* Input Area — always at the bottom, shrink-0 so it never scrolls away */}
            <div className="shrink-0 flex flex-col gap-1">
                {/* @mention hint */}
                <div className="flex items-center gap-1 px-1 text-[9px] text-slate-600">
                    <AtSign className="w-2.5 h-2.5 shrink-0" />
                    <span>Escribe <span className="text-slate-500 font-mono">@nombre</span> para mencionar a un jugador conectado</span>
                </div>

                {/* @mention autocomplete dropdown */}
                {showMentionDropdown && (
                    <div className="relative">
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-900 border border-cyan-500/30 rounded-lg overflow-hidden shadow-xl z-50">
                            <div className="px-2 py-1 text-[8px] text-cyan-500/60 uppercase tracking-widest border-b border-white/5">
                                Mencionar jugador
                            </div>
                            {mentionSuggestions.map((name, i) => (
                                <button
                                    key={name}
                                    onMouseDown={(e) => {
                                        e.preventDefault(); // Prevent input blur
                                        completeMention(name);
                                    }}
                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                                        i === selectedSuggestion
                                            ? 'bg-cyan-500/20 text-cyan-300'
                                            : 'text-slate-300 hover:bg-white/5'
                                    }`}
                                >
                                    <AtSign className="w-3 h-3 text-cyan-500/60 shrink-0" />
                                    {name}
                                </button>
                            ))}
                            {remotePlayers.length === 0 && (
                                <div className="px-3 py-2 text-[9px] text-slate-500">
                                    No hay jugadores conectados
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <form 
                    onSubmit={handleSendMessage}
                    className="flex gap-1.5"
                >
                    <div className="relative flex-1">
                        <input 
                            ref={inputRef}
                            type="text"
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe un mensaje táctico... (@nombre para mencionar)"
                            className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2.5 pr-12 text-xs md:text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600 shadow-xl"
                            maxLength={280}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-700 pointer-events-none">
                            {inputText.length}/280
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={!inputText.trim() || !isConnected}
                        className={`
                            px-3 md:px-4 rounded-xl flex items-center justify-center transition-all shadow-xl shrink-0
                            ${!inputText.trim() || !isConnected 
                                ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20 active:scale-95'}
                        `}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>

            {showMenu && <MultiplayerMenu onClose={() => setShowMenu(false)} />}
        </div>
    );
};
