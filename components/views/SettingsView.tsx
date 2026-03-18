import React, { useState } from 'react';
import { GameState } from '../../types';
import { ResourceType } from '../../types/enums';
import { useLanguage } from '../../hooks/useLanguage';
import { Card, GlassButton, Icons, ResourceIcon } from '../UIComponents';
import { getFlagEmoji } from '../../utils/engine/rankings';
import { useAuth } from '../../hooks/useAuth';
import { APP_VERSION, AVAILABLE_FLAGS } from '../../constants';

interface SettingsViewProps {
    gameState: GameState;
    changePlayerName: (name: string, flag?: string) => { success: boolean; errorKey?: string };
    redeemGiftCode: (code: string) => { success: boolean; messageKey?: string; params?: Record<string, any>; hoursRemaining?: number; minutesRemaining?: number };
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
    gameState, 
    changePlayerName, 
    redeemGiftCode,
}) => {
    const { t, setLanguage, language } = useLanguage();
    const { signOut } = useAuth();
    const [newName, setNewName] = useState('');
    const [nameError, setNameError] = useState<string | null>(null);
    const [nameSuccess, setNameSuccess] = useState(false);
    const [giftCode, setGiftCode] = useState('');
    const [giftCodeStatus, setGiftCodeStatus] = useState<{ type: 'success' | 'error' | 'cooldown' | null; message: string }>({ type: null, message: '' });
    const [selectedFlag, setSelectedFlag] = useState<string | undefined>(gameState.playerFlag);
    const [flagSuccess, setFlagSuccess] = useState(false);
    const [showFlagPicker, setShowFlagPicker] = useState(false);

    const handleNameChange = () => {
        setNameError(null);
        setNameSuccess(false);
        const result = changePlayerName(newName);
        if (result.success) {
            setNameSuccess(true);
            setNewName('');
            setTimeout(() => setNameSuccess(false), 3000);
        } else if (result.errorKey) {
            setNameError(result.errorKey);
        }
    };

    const handleFlagSelect = (countryCode: string) => {
        const newFlag = countryCode === selectedFlag ? undefined : countryCode;
        setSelectedFlag(newFlag);
        // Use changePlayerName with same name but new flag (no diamond cost for flag-only change)
        const result = changePlayerName(gameState.playerName, newFlag);
        if (result.success) {
            setFlagSuccess(true);
            setShowFlagPicker(false);
            setTimeout(() => setFlagSuccess(false), 3000);
        }
    };

    const handleGiftCodeRedemption = () => {
        if (!giftCode.trim()) return;
        
        const result = redeemGiftCode(giftCode);
        
        if (result.success) {
            setGiftCodeStatus({ 
                type: 'success', 
                message: t.common.ui.gift_code_success 
            });
            setGiftCode('');
        } else if (result.messageKey === 'gift_code_cooldown' && result.params) {
            const hours = result.params.hours || 0;
            const minutes = result.params.minutes || 0;
            const message = t.common.ui.gift_code_cooldown
                .replace('{hours}', hours.toString())
                .replace('{minutes}', minutes.toString());
            setGiftCodeStatus({ type: 'cooldown', message });
        } else {
            setGiftCodeStatus({ 
                type: 'error', 
                message: t.common.ui[result.messageKey as keyof typeof t.common.ui] || t.common.ui.gift_code_invalid 
            });
        }
        
        setTimeout(() => setGiftCodeStatus({ type: null, message: '' }), 4000);
    };

    const isFreeChange = !gameState.hasChangedName;
    const nameChangeCost = isFreeChange ? 'FREE' : (
        <span className="flex items-center gap-1">
            <ResourceIcon resource={ResourceType.DIAMOND} className="w-2.5 h-2.5" alt="Diamond" />
            20
        </span>
    );
    const canAfford = isFreeChange || gameState.resources.DIAMOND >= 20;

    return (
        <div className="flex flex-col items-center w-full max-w-4xl mx-auto p-3 sm:p-4 animate-[fadeIn_0.3s_ease-out] gap-4 sm:gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 w-full">
                {/* IDIOMA Y PERFIL */}
                <div className="space-y-4 sm:space-y-6">
                    <Card title={t.common.ui.language} className="h-full">
                        <div className="flex flex-col gap-3 sm:gap-4">
                            <p className="text-xs text-slate-400 font-mono italic">
                                {language === 'es' ? 'Selecciona tu idioma preferido' : 'Select your preferred language'}
                            </p>
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                {(['en', 'es'] as const).map((lang) => (
                                    <button 
                                        key={lang} 
                                        onClick={() => setLanguage(lang)} 
                                        className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-lg border transition-all text-sm sm:text-base ${
                                            language === lang 
                                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                            : 'bg-black/20 border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className="font-bold tracking-widest">{lang.toUpperCase()}</span>
                                        {language === lang && <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="border-t border-white/10 pt-3 sm:pt-4 mt-2">
                                <p className="text-xs text-slate-400 font-mono italic mb-2">
                                    {language === 'es' ? 'Cambiar nombre de comandante' : 'Change commander name'}
                                </p>
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-0">
                                        <span className="text-xs text-slate-500 uppercase tracking-widest font-bold">{t.common.ui.current}</span>
                                        <span className="text-cyan-400 font-tech text-sm sm:text-base">{gameState.playerName}</span>
                                    </div>
                                    
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => { setNewName(e.target.value); setNameError(null); }}
                                            placeholder={t.common.ui.new_name_placeholder}
                                            maxLength={20}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                                        />
                                        {isFreeChange && (
                                            <div className="absolute -top-2 -right-2 bg-emerald-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg animate-bounce">
                                                {t.common.ui.first_change_free}
                                            </div>
                                        )}
                                    </div>

                                    <GlassButton
                                        onClick={handleNameChange}
                                        disabled={!newName.trim() || newName.trim() === gameState.playerName || !canAfford}
                                        className="w-full py-2 sm:py-2.5"
                                        variant={isFreeChange ? 'primary' : 'neutral'}
                                    >
                                        <span className="flex items-center justify-center gap-2 text-xs sm:text-sm">
                                            {t.common.actions.acknowledge}
                                            <span className={`px-2 py-0.5 rounded text-[10px] ${canAfford ? 'bg-cyan-500/20 text-cyan-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {nameChangeCost}
                                            </span>
                                        </span>
                                    </GlassButton>

                                    {nameError && (
                                        <p className="text-red-400 text-xs text-center font-mono">
                                            {(t.common.ui as Record<string, string>)[nameError] || nameError}
                                        </p>
                                    )}
                                    {nameSuccess && (
                                        <p className="text-emerald-400 text-xs text-center font-mono">
                                            {t.common.ui.name_changed_success}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* FLAG SELECTOR */}
                            <div className="border-t border-white/10 pt-3 sm:pt-4 mt-2">
                                <p className="text-xs text-slate-400 font-mono italic mb-2">
                                    {(t.common.ui as Record<string, string>).select_flag || 'Select Flag'}
                                </p>
                                <p className="text-[10px] text-slate-500 mb-2">
                                    {(t.common.ui as Record<string, string>).select_flag_desc || 'Choose your banner for PvP'}
                                </p>
                                
                                <div className="flex items-center gap-3 mb-2">
                                    <button
                                        onClick={() => setShowFlagPicker(!showFlagPicker)}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                            showFlagPicker 
                                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                                                : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                                        }`}
                                    >
                                        <span className="text-xl flex items-center justify-center">
                                            {selectedFlag ? getFlagEmoji(selectedFlag) : <Icons.Map className="w-5 h-5 opacity-40" />}
                                        </span>
                                        <span className="text-xs font-bold uppercase tracking-wider">
                                            {selectedFlag || ((t.common.ui as Record<string, string>).no_flag || 'No flag')}
                                        </span>
                                    </button>
                                    
                                    {selectedFlag && (
                                        <button
                                            onClick={() => handleFlagSelect(selectedFlag)}
                                            className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider transition-colors"
                                        >
                                            {t.common.actions.cancel}
                                        </button>
                                    )}
                                </div>

                                {flagSuccess && (
                                    <p className="text-emerald-400 text-xs text-center font-mono mb-2">
                                        {(t.common.ui as Record<string, string>).flag_changed_success || 'Flag updated!'}
                                    </p>
                                )}

                                {showFlagPicker && (
                                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 p-2 bg-black/40 border border-white/10 rounded-lg max-h-48 overflow-y-auto custom-scrollbar animate-[fadeIn_0.2s_ease-out]">
                                        {AVAILABLE_FLAGS.map((code) => (
                                            <button
                                                key={code}
                                                onClick={() => handleFlagSelect(code)}
                                                className={`flex flex-col items-center justify-center p-1.5 rounded-lg transition-all hover:scale-110 ${
                                                    selectedFlag === code
                                                        ? 'bg-cyan-500/30 border border-cyan-500/60 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                                                        : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/20'
                                                }`}
                                                title={code}
                                            >
                                                <span className="text-lg sm:text-xl">{getFlagEmoji(code)}</span>
                                                <span className="text-[8px] text-slate-500 mt-0.5">{code}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-white/10 pt-3 sm:pt-4 mt-2">
                                <p className="text-xs text-slate-400 font-mono italic mb-2">
                                    {language === 'es' ? 'Códigos de Regalo' : 'Gift Codes'}
                                </p>
                                <div className="space-y-2 sm:space-y-3">
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                                        <input
                                            type="text"
                                            value={giftCode}
                                            onChange={(e) => { setGiftCode(e.target.value.toUpperCase()); setGiftCodeStatus({ type: null, message: '' }); }}
                                            placeholder={t.common.ui.gift_code_placeholder}
                                            maxLength={20}
                                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-all font-mono uppercase"
                                        />
                                        <GlassButton
                                            onClick={handleGiftCodeRedemption}
                                            disabled={!giftCode.trim()}
                                            className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3"
                                            variant="primary"
                                        >
                                            <span className="text-xs sm:text-sm whitespace-nowrap">
                                                {t.common.ui.gift_code_redeem}
                                            </span>
                                        </GlassButton>
                                    </div>

                                    {giftCodeStatus.type && (
                                        <div className={`p-2 sm:p-3 rounded-lg text-xs sm:text-sm font-mono text-center animate-[fadeIn_0.2s_ease-out] ${
                                            giftCodeStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                            giftCodeStatus.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                            'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                        }`}>
                                            {giftCodeStatus.message}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Card>

                </div>

                {/* GESTIÓN DE DATOS */}
                <div className="space-y-4 sm:space-y-6">
                    <Card title={t.common.ui.system} className="h-full">
                        <div className="flex flex-col gap-4 sm:gap-6 h-full justify-between">
                            <div className="space-y-3 sm:space-y-4">
                                <div className="grid grid-cols-1 gap-2 sm:gap-3">
                                    <GlassButton onClick={signOut} variant="danger" className="w-full justify-start px-4 sm:px-6 py-2.5 sm:py-3 shadow-lg">
                                        <span className="flex items-center gap-2 sm:gap-3 text-sm sm:text-base">
                                            <Icons.LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                                            {t.common.auth.logout}
                                        </span>
                                    </GlassButton>
                                </div>
                            </div>

                        </div>
                    </Card>
                </div>
            </div>
            
            <div className="text-center pb-6 sm:pb-8 opacity-30">
                <p className="text-[9px] sm:text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em]">Sector Zero OS {APP_VERSION} - Tactical Terminal</p>
            </div>
        </div>
    );
};
