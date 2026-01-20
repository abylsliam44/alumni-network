import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * [MVP v1] Lightweight WebSocket manager for chat events.
 * Supports: new_message, typing, message_read, presence, online_users
 */
export const useChatSocket = ({ onNewMessage, onTypingEvent, onMessageRead, onPresenceEvent, onOnlineUsers }) => {
  const [status, setStatus] = useState('disconnected');
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const getWsUrl = () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const httpBase =
      import.meta.env.VITE_API_URL ||
      window.location.origin ||
      window.location.origin;
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

  // Helper to check if token is expired (simple JWT decode)
  const isTokenExpired = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // Buffer of 30 seconds
      if (payload.exp && Date.now() >= payload.exp * 1000 - 30000) {
        return true;
      }
      return false;
    } catch (e) {
      return true;
    }
  };

  const connect = useCallback(async () => {
    let token = localStorage.getItem('token');
    if (!token) return;

    // Convert http(s) to ws(s)
    const httpBase =
      import.meta.env.VITE_API_URL ||
      window.location.origin ||
      window.location.origin;
    const base = import.meta.env.VITE_WS_URL || httpBase;
    const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    const sanitizedBase = wsBase.endsWith('/') ? wsBase.slice(0, -1) : wsBase;

    // Check expiry
    if (isTokenExpired(token)) {
      console.log('WS Token expired, attempting refresh...');
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          // We use fetch here to avoid circular dep with axios interceptor nuances
          const refreshUrl = `${httpBase.replace(/\/$/, '')}/api/v1/auth/refresh?refresh_token=${refreshToken}`;
          const res = await fetch(refreshUrl, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            localStorage.setItem('token', data.access_token);
            if (data.refresh_token) localStorage.setItem('refreshToken', data.refresh_token);
            token = data.access_token;
            console.log('WS Token refreshed successfully');
          } else {
            console.error('WS Refresh failed, status:', res.status);
            return; // Abort connection
          }
        } catch (e) {
          console.error('WS Refresh network error:', e);
          return;
        }
      } else {
        return; // No refresh token, abort
      }
    }

    const wsUrl = `${sanitizedBase}/ws/chat?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.onopen = () => setStatus('connected');
    ws.onclose = () => {
      setStatus('disconnected');
      reconnectRef.current = setTimeout(connect, 3000);
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
