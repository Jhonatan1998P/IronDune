import { useState, useCallback, useEffect } from 'react';
import { useMultiplayer } from './useMultiplayer';
import { MultiplayerActionType, ChatMessagePayload } from '../types/multiplayer';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isLocal: boolean;
}

export const useMultiplayerChat = () => {
  const { isConnected, localPlayerId, broadcastAction, onRemoteAction } = useMultiplayer();
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

    setMessages(prev => [...prev, newMessage].slice(-100)); // Mantener últimos 100 mensajes
  }, [isConnected, localPlayerId, broadcastAction]);

  useEffect(() => {
    onRemoteAction((action) => {
      if (action.type === MultiplayerActionType.CHAT_MESSAGE) {
        const payload = action.payload as ChatMessagePayload;
        const newMessage: ChatMessage = {
          id: `${action.playerId}-${action.timestamp}`,
          senderId: action.playerId,
          senderName: payload.senderName || 'Jugador Desconocido',
          text: payload.text,
          timestamp: action.timestamp,
          isLocal: false,
        };
        setMessages(prev => [...prev, newMessage].slice(-100));
      }
    });
  }, [onRemoteAction]);

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
