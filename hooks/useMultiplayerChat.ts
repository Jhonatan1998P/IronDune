import { useState, useCallback, useEffect } from 'react';
import { useMultiplayer } from './useMultiplayer';
import { MultiplayerActionType, ChatMessagePayload } from '../types/multiplayer';
import { gameEventBus } from '../utils/eventBus';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

const P2P_CHAT_STORAGE_KEY = 'ironDuneP2PChatMessages';
const MAX_CHAT_MESSAGES = 20;

const loadChatFromStorage = (): ChatMessage[] => {
  try {
    const saved = localStorage.getItem(P2P_CHAT_STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed.slice(-MAX_CHAT_MESSAGES);
    }
    return [];
  } catch (e) {
    console.error('Failed to load P2P chat messages from localStorage:', e);
    return [];
  }
};

const saveChatToStorage = (messages: ChatMessage[]) => {
  try {
    const limited = messages.slice(-MAX_CHAT_MESSAGES);
    localStorage.setItem(P2P_CHAT_STORAGE_KEY, JSON.stringify(limited));
  } catch (e) {
    console.error('Failed to save P2P chat messages to localStorage:', e);
  }
};

export const useMultiplayerChat = () => {
  const { isConnected, localPlayerId, broadcastAction } = useMultiplayer();
  const [messages, setMessages] = useState<ChatMessage[]>(loadChatFromStorage);

  const sendMessage = useCallback((text: string, playerName: string) => {
    if (!isConnected || !localPlayerId || !text.trim()) return;

    const payload: ChatMessagePayload = {
      text: text.trim(),
      senderName: playerName,
    };

    broadcastAction({
      type: MultiplayerActionType.CHAT_MESSAGE,
      payload,
      playerId: localPlayerId,
      timestamp: Date.now(),
    });

    // Añadir mensaje localmente
    const newMessage: ChatMessage = {
      id: `${localPlayerId}-${Date.now()}`,
      senderId: localPlayerId,
      senderName: playerName,
      text: text.trim(),
      timestamp: Date.now(),
      isLocal: true,
    };

    setMessages(prev => {
      const newMessages = [...prev, newMessage].slice(-MAX_CHAT_MESSAGES);
      saveChatToStorage(newMessages);
      return newMessages;
    });
  }, [isConnected, localPlayerId, broadcastAction]);

  useEffect(() => {
    const handleLocalUpdate = (updatedMessages: ChatMessage[]) => {
      setMessages(updatedMessages);
    };

    gameEventBus.on('LOCAL_CHAT_UPDATED' as any, handleLocalUpdate);
    return () => {
      gameEventBus.off('LOCAL_CHAT_UPDATED' as any, handleLocalUpdate);
    };
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(P2P_CHAT_STORAGE_KEY);
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isConnected,
  };
};
