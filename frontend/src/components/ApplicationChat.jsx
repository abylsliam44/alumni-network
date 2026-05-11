import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { jobsApi } from '../api/jobs';
import Icon from './ui/Icon';

const ApplicationChat = ({ applicationId }) => {
  const { token: authToken, user } = useAuth();
  const token = authToken || localStorage.getItem('token');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    jobsApi.getChatHistory(applicationId).then(setMessages).catch(console.error);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!token) { setConnected(false); return undefined; }

    const ws = new WebSocket(`${protocol}//${wsHost}/api/v1/job-chat/ws/${applicationId}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (event) => {
      try { setMessages((p) => [...p, JSON.parse(event.data)]); }
      catch (e) { console.error('WS parse error', e); }
    };
    ws.onclose = () => setConnected(false);
    return () => ws.close();
  }, [applicationId, token]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(input);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 400, border: '1px solid var(--line-soft)', borderRadius: 10, background: 'var(--surface)' }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 className="h3">Application chat</h3>
        <span className={`pill ${connected ? 'ok' : 'err'}`} style={{ fontSize: 9.5 }}>
          <span className="dot" /> {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={i} className={`messages-bubble ${isMe ? 'out' : 'in'}`} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
              <div>{msg.message}</div>
              <div className="mono" style={{ fontSize: 9.5, marginTop: 4, opacity: 0.7 }}>
                {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={{ padding: 12, borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message…" />
        <button type="submit" className="btn primary" disabled={!connected || !input.trim()}>
          <Icon name="send" size={12} />
        </button>
      </form>
    </div>
  );
};

export default ApplicationChat;
