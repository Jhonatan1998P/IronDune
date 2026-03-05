
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useMultiplayerChat } from '../../hooks/useMultiplayerChat';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useP2PGiftResource } from '../../hooks/useP2PGiftResource';
import { GameState } from '../../types';
import { GlassButton, Icons } from '../UIComponents';
import { MultiplayerMenu } from '../UI/MultiplayerMenu';
import { Send, Users, MessageSquare, Shield, Gift, Droplets, Coins, Crosshair } from 'lucide-react';

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
    const scrollRef = useRef<HTMLDivElement>(null);

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

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !isConnected) return;
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

    return (
        <div className="h-full w-full flex flex-col gap-2 md:gap-3 animate-[fadeIn_0.3s_ease-out] overflow-x-hidden">
            {/* Header Area */}
            <div className="shrink-0 flex items-center justify-between gap-2 md:gap-3 bg-slate-950/40 p-2 md:p-3 rounded-lg md:rounded-xl border border-white/5">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <div className="relative shrink-0">
                        <div className="p-1.5 md:p-2 bg-cyan-500/20 rounded-lg">
                            <Users className="w-3 md:w-4 h-3 md:h-4 text-cyan-400" />
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-2 md:w-2.5 h-2 md:h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[9px] md:text-[10px] text-cyan-500/70 uppercase tracking-widest font-bold leading-none mb-0.5 md:mb-1">Sala Activa</div>
                        <div className="text-[10px] md:text-xs font-mono text-cyan-300 truncate">{currentRoomId}</div>
                    </div>
                </div>

                <div className="flex items-center gap-1 md:gap-2">
                    <div className="hidden sm:flex flex-col items-end mr-1 md:mr-2">
                        <div className="text-[9px] md:text-[10px] text-slate-500 uppercase font-bold">{peers.length + 1} Conectados</div>
                    </div>
                    {/* Gift panel toggle */}
                    <button
                        onClick={() => setShowGiftPanel(v => !v)}
                        className={`p-1.5 md:p-2 rounded-lg border transition-colors ${showGiftPanel ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'hover:bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                        title="Enviar recursos"
                    >
                        <Gift className="w-3 md:w-4 h-3 md:h-4" />
                    </button>
                    <button 
                        onClick={() => setShowMenu(true)}
                        className="p-1.5 md:p-2 hover:bg-white/5 rounded-lg border border-white/10 transition-colors text-slate-400 hover:text-white"
                    >
                        <Icons.Settings className="w-3 md:w-4 h-3 md:h-4" />
                    </button>
                </div>
            </div>

            {/* Gift Panel */}
            {showGiftPanel && (
                <div className="shrink-0 bg-slate-950/60 border border-white/10 rounded-xl p-3 animate-[fadeIn_0.2s_ease-out]">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                            <Gift className="w-3 h-3" /> Enviar Recursos (se envía a todos)
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                            Reset en {fmtMs(msUntilReset)}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(Object.keys(RESOURCE_META) as GiftableResource[]).map(res => {
                            const meta = RESOURCE_META[res];
                            const cap = getTotalCap(res);
                            const remaining = getRemainingLimit(res);
                            const sent = getAlreadySent(res);
                            const pctSent = cap > 0 ? Math.min(1, sent / cap) : 0;

                            return (
                                <div key={res} className={`rounded-lg border ${meta.border} ${meta.bg} p-2 flex flex-col gap-1.5`}>
                                    {/* Resource header */}
                                    <div className="flex items-center gap-1.5">
                                        <meta.Icon className={`w-3.5 h-3.5 ${meta.color} shrink-0`} />
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                                        <span className="ml-auto text-[9px] text-slate-500 font-mono">Lím: {fmt(cap)}</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${pctSent >= 1 ? 'bg-red-500' : meta.color.replace('text-', 'bg-')}`}
                                            style={{ width: `${pctSent * 100}%` }}
                                        />
                                    </div>

                                    {/* Sent / remaining */}
                                    <div className="flex justify-between text-[8px] text-slate-500 font-mono">
                                        <span>Enviado: {fmt(sent)}</span>
                                        <span className={remaining > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            Disponible: {fmt(remaining)}
                                        </span>
                                    </div>

                                    {/* Send buttons */}
                                    {remaining > 0 ? (
                                        <div className="flex gap-1 mt-0.5">
                                            {([0.25, 0.5, 1] as const).map(frac => (
                                                <button
                                                    key={frac}
                                                    onClick={() => handleSendResource(res, frac)}
                                                    className={`flex-1 text-[8px] font-bold py-1 rounded border transition-all ${meta.border} ${meta.bg} ${meta.color} hover:opacity-80 active:scale-95`}
                                                >
                                                    {frac === 1 ? 'MAX' : `${frac * 100}%`}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[8px] text-red-400/80 text-center py-0.5">Límite diario alcanzado</div>
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

                    <p className="text-[8px] text-slate-600 mt-2 text-center">
                        Límite diario: 4 horas de producción por recurso. Se reinicia cada 24h.
                    </p>
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950/20 rounded-xl md:rounded-2xl border border-white/5 relative shadow-inner">
                {/* Messages List */}
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4 custom-scrollbar"
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
                                <div className={`flex items-center gap-1 md:gap-2 mb-0.5 md:mb-1 px-1 ${msg.isLocal ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider ${msg.isLocal ? 'text-cyan-400' : 'text-amber-400'}`}>
                                        {msg.senderName}
                                    </span>
                                    <span className="text-[7px] md:text-[8px] text-slate-600 font-mono">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className={`
                                    max-w-[85%] px-3 md:px-4 py-2 md:py-2.5 rounded-xl md:rounded-2xl text-xs md:text-sm relative break-words shadow-lg
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

                {/* Quick Info Bar */}
                <div className="shrink-0 px-2 md:px-4 py-1 md:py-1.5 border-t border-white/5 bg-black/20 flex items-center justify-between text-[8px] md:text-[9px] text-slate-500 uppercase tracking-tighter">
                    <span className="flex items-center gap-1">
                        <Shield className="w-2 md:w-2.5 h-2 md:h-2.5" /> P2P Encriptado
                    </span>
                    <span className="flex items-center gap-1">
                        {remotePlayers.length > 0 ? (
                            <span className="text-emerald-500/70">{remotePlayers.length} aliados cerca</span>
                        ) : (
                            "Solo tú en la frecuencia"
                        )}
                    </span>
                </div>
            </div>

            {/* Input Area */}
            <form 
                onSubmit={handleSendMessage}
                className="shrink-0 flex gap-1 md:gap-2"
            >
                <div className="relative flex-1">
                    <input 
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Escribe un mensaje táctico..."
                        className="w-full bg-slate-900/80 border border-white/10 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3.5 pr-10 md:pr-12 text-xs md:text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-600 shadow-xl"
                        maxLength={280}
                    />
                    <div className="absolute right-2.5 md:right-3 top-1/2 -translate-y-1/2 text-[9px] md:text-[10px] font-mono text-slate-700 pointer-events-none">
                        {inputText.length}/280
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={!inputText.trim() || !isConnected}
                    className={`
                        p-2.5 md:p-4 rounded-lg md:rounded-xl flex items-center justify-center transition-all shadow-xl
                        ${!inputText.trim() || !isConnected 
                            ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' 
                            : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20 active:scale-95'}
                    `}
                >
                    <Send className="w-4 md:w-5 h-4 md:h-5" />
                </button>
            </form>

            {showMenu && <MultiplayerMenu onClose={() => setShowMenu(false)} />}
        </div>
    );
};
