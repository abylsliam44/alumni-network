import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { jobsApi } from '../api/jobs';
import Button from './ui/Button';

const ApplicationChat = ({ applicationId }) => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load history
    jobsApi.getChatHistory(applicationId).then(setMessages).catch(console.error);

    // Connect WS - use environment variable or derive from current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Get backend URL from environment or derive from current host
    const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const wsEndpoint = `${protocol}//${wsHost}/api/v1/job-chat/ws/${applicationId}?token=${token}`;

    const ws = new WebSocket(wsEndpoint);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS Connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setMessages(prev => [...prev, msg]);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onclose = () => {
      console.log('WS Disconnected');
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [applicationId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current) return;

    wsRef.current.send(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[400px] border rounded bg-white">
      <div className="p-3 border-b bg-gray-50 flex justify-between">
        <h3 className="font-semibold">Chat with Applicant/Recruiter</h3>
        <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === user.id;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] p-3 rounded-lg ${isMe ? 'bg-primary text-white' : 'bg-gray-100'}`}>
                <p>{msg.message}</p>
                <span className="text-xs opacity-70 block mt-1">
                  {new Date(msg.created_at || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <Button type="submit" disabled={!connected}>Send</Button>
      </form>
    </div>
  );
};

export default ApplicationChat;
