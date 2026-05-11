import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * [MVP v1] Lightweight WebSocket manager for chat events.
 * Supports: new_message, typing, message_read, presence, online_users
 */
export const useChatSocket = ({ onNewMessage, onTypingEvent, onMessageRead, onPresenceEvent, onOnlineUsers }) => {
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const pingRef = useRef(null);
  const shouldReconnectRef = useRef(true);

  const getWsUrl = useCallback(() => {
    const httpBase =
      import.meta.env.VITE_API_URL ||
      window.location.origin ||
      window.location.origin;
    // Convert http(s):// to ws(s)://
    const base = import.meta.env.VITE_WS_URL || httpBase;
    const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    const sanitizedBase = wsBase.endsWith('/') ? wsBase.slice(0, -1) : wsBase;
    return `${sanitizedBase}/ws/chat`;
  }, []);

  const sendEvent = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const clearPing = useCallback(() => {
    if (pingRef.current) {
      clearInterval(pingRef.current);
      pingRef.current = null;
    }
  }, []);

  const handleMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'new_message' && onNewMessage) {
          onNewMessage(data.payload);
        } else if (['typing_start', 'typing_stop'].includes(data.type) && onTypingEvent) {
          onTypingEvent({ ...data.payload, type: data.type });
        } else if (data.type === 'message_read' && onMessageRead) {
          onMessageRead(data.payload);
        } else if (data.type === 'presence' && onPresenceEvent) {
          // Handle user going online/offline
          onPresenceEvent(data.payload);
        } else if (data.type === 'online_users' && onOnlineUsers) {
          // Handle initial list of online friends
          onOnlineUsers(data.payload);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    },
    [onMessageRead, onNewMessage, onTypingEvent, onPresenceEvent, onOnlineUsers]
  );

  const connect = useCallback(async () => {
    const httpBase =
      import.meta.env.VITE_API_URL ||
      window.location.origin ||
      window.location.origin;

    try {
      await fetch(`${httpBase.replace(/\/$/, '')}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {
      // The WebSocket handshake will still enforce authentication.
    }

    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setStatus('connected');
      ws.send(JSON.stringify({ type: 'get_online_users', payload: {} }));
      clearPing();
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping', payload: {} }));
        }
      }, 20000);
    };
    ws.onclose = () => {
      setStatus('disconnected');
      clearPing();
      if (shouldReconnectRef.current) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };
    ws.onerror = () => setStatus('error');
    ws.onmessage = handleMessage;
  }, [clearPing, getWsUrl, handleMessage]);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      clearPing();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [clearPing, connect]);

  return { status, sendEvent };
};
