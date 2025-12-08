import { useEffect, useState } from 'react';
import { messagesApi } from '../api/messages';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      messagesApi.markRead(activeId);
    }
  }, [activeId]);

  const loadConversations = async () => {
    const data = await messagesApi.listConversations();
    setConversations(data);
    if (data.length) {
      setActiveId(data[0].id);
    }
  };

  const loadMessages = async (id) => {
    const data = await messagesApi.getConversationMessages(id);
    setMessages(data);
  };

  const send = async () => {
    if (!content) return;
    // send to other participant
    const convo = conversations.find((c) => c.id === activeId);
    const recipientId = convo.participant1_id === user.id ? convo.participant2_id : convo.participant1_id;
    const msg = await messagesApi.sendMessage({ conversation_id: activeId, recipient_id: recipientId, content });
    setMessages((prev) => [...prev, msg]);
    setContent('');
  };

  return (
    <div className="page messages-page">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Conversations with your network.</p>
      </div>
      <div className="messages-layout">
        <Card className="convo-list">
          {conversations.map((c) => {
            const isActive = c.id === activeId;
            return (
              <button key={c.id} className={`convo-item ${isActive ? 'active' : ''}`} onClick={() => setActiveId(c.id)}>
                <div className="title">Conversation</div>
                <div className="muted">{c.last_message || 'Start the conversation'}</div>
                {c.unread_count > 0 && <span className="pill">{c.unread_count}</span>}
              </button>
            );
          })}
        </Card>
        <Card className="chat-thread">
          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.sender_id === user.id ? 'outgoing' : 'incoming'}`}>
                {m.content}
              </div>
            ))}
          </div>
          {activeId && (
            <div className="chat-composer">
              <input value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type your message..." />
              <Button onClick={send} variant="primary">Send</Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Messages;

