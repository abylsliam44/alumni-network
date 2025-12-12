import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * [MVP v1] Lightweight WebSocket manager for chat events.
 */
export const useChatSocket = ({ onNewMessage, onTypingEvent, onMessageRead }) => {
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const getWsUrl = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const httpBase =
      import.meta.env.VITE_API_URL ||
      window.location.origin ||
      'http://localhost:8010';
    // Convert http(s):// to ws(s)://
    const base = import.meta.env.VITE_WS_URL || httpBase;
    const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    const sanitizedBase = wsBase.endsWith('/') ? wsBase.slice(0, -1) : wsBase;
    return `${sanitizedBase}/ws/chat?token=${token}`;
  };

  const sendEvent = useCallback((type, payload) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
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
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    },
    [onMessageRead, onNewMessage, onTypingEvent]
  );

  const connect = useCallback(() => {
    const url = getWsUrl();
    if (!url) return;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setStatus('connected');
    ws.onclose = () => {
      setStatus('disconnected');
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onerror = () => setStatus('error');
    ws.onmessage = handleMessage;
  }, [handleMessage]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { status, sendEvent };
};
