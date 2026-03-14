import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Icons } from '../UIComponents';

interface Message {
    id: string;
    sender_id: string;
    receiver_id: string;
    subject: string;
    body: string;
    read_at: string | null;
    created_at: string;
    sender_name?: string;
}

export const MessagesView: React.FC = () => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [isWriting, setIsWriting] = useState(false);
    
    // Form state
    const [recipient, setRecipient] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);

    const fetchMessages = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('inbox')
                .select(`
                    *,
                    sender:profiles!inbox_sender_id_fkey(username)
                `)
                .eq('receiver_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            const formattedMessages = (data || []).map((m: any) => ({
                ...m,
                sender_name: m.sender?.username || 'System'
            }));
            
            setMessages(formattedMessages);
        } catch (e) {
            console.error('Error fetching messages:', e);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchMessages();
    }, [fetchMessages]);

    const handleReadMessage = async (msg: Message) => {
        setSelectedMessage(msg);
        if (!msg.read_at) {
            try {
                await supabase
                    .from('inbox')
                    .update({ read_at: new Date().toISOString() })
                    .eq('id', msg.id);
                
                // Update local state
                setMessages(prev => prev.map(m => 
                    m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m
                ));
            } catch (e) {
                console.error('Error marking as read:', e);
            }
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !recipient || !body) return;
        
        setSending(true);
        try {
            // Find user by username
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', recipient)
                .single();
            
            if (userError || !userData) {
                alert('User not found');
                setSending(false);
                return;
            }

            const { error } = await supabase
                .from('inbox')
                .insert({
                    sender_id: user.id,
                    receiver_id: userData.id,
                    subject: subject || '(No Subject)',
                    body: body
                });

            if (error) throw error;

            alert('Message sent!');
            setIsWriting(false);
            setRecipient('');
            setSubject('');
            setBody('');
        } catch (e) {
            console.error('Error sending message:', e);
            alert('Failed to send message');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col h-full animate-[fadeIn_0.3s_ease-out] gap-4">
            <header className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                    <Icons.Mail className="text-blue-400 w-6 h-6" />
                    <h2 className="text-xl font-tech text-white uppercase tracking-widest">Secure Communications</h2>
                </div>
                <button 
                    onClick={() => {
                        setIsWriting(!isWriting);
                        setSelectedMessage(null);
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${isWriting ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/40'}`}
                >
                    {isWriting ? <Icons.Close /> : <Icons.Mail />}
                    {isWriting ? 'Cancel' : 'Compose'}
                </button>
            </header>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
                {/* Message List */}
                <div className={`flex-1 md:w-1/3 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 ${selectedMessage || isWriting ? 'hidden md:flex' : 'flex'}`}>
                    {loading ? (
                        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : messages.length === 0 ? (
                        <div className="text-center p-8 text-slate-500 font-mono text-sm border border-dashed border-white/10 rounded-xl">NO INCOMING TRANSMISSIONS</div>
                    ) : (
                        messages.map(msg => (
                            <button
                                key={msg.id}
                                onClick={() => handleReadMessage(msg)}
                                className={`text-left p-4 rounded-xl border transition-all relative group overflow-hidden ${!msg.read_at ? 'bg-blue-500/10 border-blue-500/30' : 'bg-slate-900/40 border-white/5 hover:border-white/20'}`}
                            >
                                {!msg.read_at && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>}
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-bold text-xs ${!msg.read_at ? 'text-blue-300' : 'text-slate-300'}`}>{msg.sender_name}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{new Date(msg.created_at).toLocaleString()}</span>
                                </div>
                                <h3 className={`text-sm truncate ${!msg.read_at ? 'text-white' : 'text-slate-400'}`}>{msg.subject}</h3>
                            </button>
                        ))
                    )}
                </div>

                {/* Message Content or Compose Area */}
                <div className={`flex-[2] bg-slate-900/60 rounded-2xl border border-white/10 overflow-hidden flex flex-col ${!selectedMessage && !isWriting ? 'hidden md:flex items-center justify-center' : 'flex'}`}>
                    {isWriting ? (
                        <form onSubmit={handleSendMessage} className="p-6 flex flex-col gap-4 h-full">
                            <h3 className="font-tech text-blue-400 uppercase tracking-widest text-sm mb-2">New Transmission</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Recipient Username</label>
                                    <input 
                                        required
                                        value={recipient}
                                        onChange={e => setRecipient(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none transition-colors"
                                        placeholder="Enter commander name..."
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Subject</label>
                                    <input 
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none transition-colors"
                                        placeholder="Mission briefing..."
                                    />
                                </div>
                                <div className="flex-1 min-h-0">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Message Body</label>
                                    <textarea 
                                        required
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                        className="w-full h-48 md:h-64 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500 outline-none transition-colors resize-none"
                                        placeholder="Classified information..."
                                    />
                                </div>
                            </div>
                            <div className="mt-auto pt-4 flex gap-2">
                                <button 
                                    type="button"
                                    onClick={() => setIsWriting(false)}
                                    className="flex-1 md:flex-none px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold uppercase text-xs border border-white/5"
                                >
                                    Cancel
                                </button>
                                <button 
                                    disabled={sending}
                                    type="submit"
                                    className="flex-[2] md:flex-none md:w-48 px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold uppercase text-xs shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Icons.Mail />}
                                    {sending ? 'Encrypting...' : 'Send Transmission'}
                                </button>
                            </div>
                        </form>
                    ) : selectedMessage ? (
                        <div className="flex flex-col h-full">
                            <div className="p-6 border-b border-white/5 bg-white/5">
                                <button onClick={() => setSelectedMessage(null)} className="md:hidden mb-4 text-blue-400 text-xs flex items-center gap-1 font-bold">
                                    <Icons.ChevronLeft /> BACK TO INBOX
                                </button>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">{selectedMessage.subject}</h3>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="text-slate-400">From:</span>
                                            <span className="text-blue-400 font-bold">{selectedMessage.sender_name}</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">{new Date(selectedMessage.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-black/20">
                                <div className="text-slate-300 whitespace-pre-wrap font-mono text-sm leading-relaxed">
                                    {selectedMessage.body}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-900/40 border-t border-white/5 flex gap-2">
                                <button 
                                    onClick={() => {
                                        setRecipient(selectedMessage.sender_name || '');
                                        setSubject(`RE: ${selectedMessage.subject}`);
                                        setIsWriting(true);
                                        setSelectedMessage(null);
                                    }}
                                    className="flex-1 md:flex-none px-6 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg font-bold text-xs uppercase hover:bg-blue-500/30 transition-all"
                                >
                                    Reply
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 p-12 text-center opacity-40">
                            <Icons.Mail className="w-16 h-16 text-slate-600" />
                            <p className="font-mono text-sm uppercase tracking-widest text-slate-500">Select a message to decrypt</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
