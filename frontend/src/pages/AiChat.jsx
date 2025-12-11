import { useEffect, useRef, useState } from 'react';
import { aiApi } from '../api/ai';

// Icons
const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);


const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/>
    <rect width="16" height="12" x="4" y="8" rx="2"/>
    <path d="M2 14h2"/>
    <path d="M20 14h2"/>
    <path d="M15 13v2"/>
    <path d="M9 13v2"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const BookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const GraduationCapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

// Suggested prompts
const SUGGESTED_PROMPTS = [
  { icon: <BookIcon />, text: "What courses are available?", category: "Academics" },
  { icon: <UsersIcon />, text: "How do I find a mentor?", category: "Mentorship" },
  { icon: <GraduationCapIcon />, text: "Tell me about programs at AITU", category: "Programs" },
  { icon: <CalendarIcon />, text: "What events are coming up?", category: "Events" },
];

const AiChat = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingTarget, setTypingTarget] = useState('');
  const [typingText, setTypingText] = useState('');
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const typingTimer = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load history from backend
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await aiApi.history();
        setMessages(res.messages || []);
        setHistory(res.messages || []);
      } catch (e) {
        // ignore history load errors
      }
    };
    loadHistory();
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingText]);

  const send = async (customQuestion) => {
    const q = customQuestion || question;
    if (!q.trim()) return;
    
    setLoading(true);
    setError('');
    const newMessages = [...messages, { role: 'user', content: q, created_at: new Date().toISOString() }];
    setMessages(newMessages);
    setQuestion('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '56px';
    }
    
    try {
      const res = await aiApi.chat(q.trim());
      const assistantMessage = { 
        role: 'assistant', 
        content: res.answer, 
        created_at: new Date().toISOString() 
      };
      setMessages([...newMessages, assistantMessage]);
      setHistory([...newMessages, assistantMessage]);
      setTypingTarget(res.answer);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get response. Please try again.');
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

  const handleTextareaChange = (e) => {
    setQuestion(e.target.value);
    // Auto-resize textarea
    e.target.style.height = '56px';
    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
  };

  // Typing animation effect
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
    }, 12);
    return () => typingTimer.current && clearInterval(typingTimer.current);
  }, [typingTarget]);

  const renderContent = (m, idx) => {
    const isLastAssistant = m.role === 'assistant' && idx === messages.length - 1 && typingTarget;
    if (isLastAssistant) {
      return typingText || '';
    }
    return m.content;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group history by date
  const groupedHistory = history.reduce((groups, msg) => {
    const date = formatDate(msg.created_at);
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  return (
    <div className="ai-page">
      {/* Main Chat Area */}
      <main className="ai-main">
        {/* Header */}
        <header className="ai-header">
          <div className="ai-header-text">
            <h1>AI Assistant</h1>
            <p>Your guide to Astana IT University</p>
          </div>
        </header>

        {/* Chat Messages */}
        <div className="ai-messages-container">
          {messages.length === 0 ? (
            <div className="ai-welcome">
              <h2>How can I help you today?</h2>
              <p>Ask me anything about courses, campus life, mentorship, or academics at AITU.</p>
              
              {/* Suggested Prompts */}
              <div className="ai-suggestions">
                {SUGGESTED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    className="ai-suggestion-card"
                    onClick={() => send(prompt.text)}
                    style={{ animationDelay: `${idx * 0.1}s` }}
                  >
                    <div className="ai-suggestion-icon">{prompt.icon}</div>
                    <div className="ai-suggestion-content">
                      <span className="ai-suggestion-category">{prompt.category}</span>
                      <span className="ai-suggestion-text">{prompt.text}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ai-messages-list">
              {messages.map((m, idx) => (
                <div 
                  key={idx} 
                  className={`ai-message ${m.role}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="ai-message-avatar">
                    {m.role === 'user' ? <UserIcon /> : <BotIcon />}
                  </div>
                  <div className="ai-message-content">
                    <div className="ai-message-header">
                      <span className="ai-message-author">
                        {m.role === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                      <span className="ai-message-time">
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                    <div className="ai-message-text">
                      {renderContent(m, idx)}
                      {m.role === 'assistant' && idx === messages.length - 1 && typingTarget && (
                        <span className="ai-cursor" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {loading && (
                <div className="ai-message assistant loading">
                  <div className="ai-message-avatar">
                    <BotIcon />
                  </div>
                  <div className="ai-message-content">
                    <div className="ai-thinking">
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-dot" />
                      <span className="ai-thinking-text">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="ai-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Composer */}
        <footer className="ai-composer">
          <div className="ai-composer-inner">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={handleTextareaChange}
              onKeyDown={onKey}
              placeholder="Ask about Astana IT University..."
              rows={1}
              disabled={loading}
            />
            <button 
              className={`ai-send-btn ${question.trim() ? 'active' : ''}`}
              onClick={() => send()}
              disabled={loading || !question.trim()}
            >
              {loading ? (
                <div className="ai-send-loader" />
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
          <p className="ai-disclaimer">
            AI responses are for informational purposes only. Verify important information with official sources.
          </p>
        </footer>
      </main>

      {/* History Sidebar */}
      <aside className="ai-sidebar">
        <div className="ai-sidebar-header">
          <button 
            className="ai-sidebar-toggle"
            onClick={() => setHistoryExpanded(!historyExpanded)}
          >
            <ClockIcon />
            <span>Chat History</span>
            <ChevronDownIcon className={historyExpanded ? 'expanded' : ''} />
          </button>
        </div>
        
        {historyExpanded && (
          <div className="ai-history-content">
            {Object.keys(groupedHistory).length === 0 ? (
              <div className="ai-history-empty">
                <ClockIcon />
                <span>No chat history yet</span>
                <p>Your conversations will appear here</p>
              </div>
            ) : (
              Object.entries(groupedHistory).map(([date, msgs]) => (
                <div key={date} className="ai-history-group">
                  <div className="ai-history-date">{date}</div>
                  {msgs.map((msg, idx) => (
                    <div 
                      key={idx} 
                      className={`ai-history-item ${msg.role}`}
                    >
                      <div className="ai-history-item-icon">
                        {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
                      </div>
                      <div className="ai-history-item-content">
                        <span className="ai-history-item-role">
                          {msg.role === 'user' ? 'You' : 'Assistant'}
                        </span>
                        <p className="ai-history-item-text">
                          {msg.content.length > 60 
                            ? msg.content.slice(0, 60) + '...' 
                            : msg.content}
                        </p>
                        <span className="ai-history-item-time">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

export default AiChat;
