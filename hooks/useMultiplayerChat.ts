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

const MAX_CHAT_MESSAGES = 20;

export const useMultiplayerChat = () => {
  const { isConnected, localPlayerId, broadcastAction } = useMultiplayer();
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
      return [...prev, newMessage].slice(-MAX_CHAT_MESSAGES);
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
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isConnected,
  };
};
