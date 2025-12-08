import { useEffect, useRef, useState } from 'react';
import { aiApi } from '../api/ai';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const AiChat = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingTarget, setTypingTarget] = useState('');
  const [typingText, setTypingText] = useState('');
  const typingTimer = useRef(null);

  const send = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    const newMessages = [...messages, { role: 'user', content: question }];
    setMessages(newMessages);
    setQuestion('');
    try {
      const res = await aiApi.chat(question.trim());
      setMessages([...newMessages, { role: 'assistant', content: res.answer }]);
      setTypingTarget(res.answer);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  useEffect(() => {
    if (!typingTarget) return;
    if (typingTimer.current) clearInterval(typingTimer.current);
    setTypingText('');
    let i = 0;
    typingTimer.current = setInterval(() => {
      i += 1;
      setTypingText(typingTarget.slice(0, i));
      if (i >= typingTarget.length) {
        clearInterval(typingTimer.current);
        setTypingTarget('');
        setTypingText('');
      }
    }, 15);
    return () => typingTimer.current && clearInterval(typingTimer.current);
  }, [typingTarget]);

  const renderContent = (m, idx) => {
    const isLastAssistant = m.role === 'assistant' && idx === messages.length - 1 && typingTarget;
    if (isLastAssistant) {
      return typingText || '...';
    }
    return m.content;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>AI Assistant</h1>
        <p className="text-secondary">Answers only about education at Astana IT University.</p>
      </div>

      <Card className="chat-card">
        <div className="chat-window">
          {messages.length === 0 && (
            <p className="text-secondary">Ask about courses, campus life, mentorship, or academics at AITU.</p>
          )}
          {messages.map((m, idx) => (
            <div key={idx} className={`chat-line ${m.role}`}>
              <div className="chat-bubble">{renderContent(m, idx)}</div>
            </div>
          ))}
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="chat-composer">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask about Astana IT University..."
            rows={2}
          />
          <Button variant="primary" onClick={send} disabled={loading}>
            {loading ? 'Thinking...' : 'Send'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AiChat;

