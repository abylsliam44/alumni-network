import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { aiApi } from '../api/ai';

const BOT_NAME = 'AqyldyAI';

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8" />
    <rect width="16" height="12" x="4" y="8" rx="2" />
    <path d="M2 14h2" />
    <path d="M20 14h2" />
    <path d="M15 13v2" />
    <path d="M9 13v2" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChevronDownIcon = ({ className = '' }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const BookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const GraduationCapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const SparkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
    <path d="M5 19l.9 2 .9-2 2-.9-2-.9L5 15l-.9 2-.9.9 2 .9z" />
    <path d="M19 15l.9 2 .9-2 2-.9-2-.9-1.8-2-.9 2-.9.9 2 .9z" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="7" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const SUGGESTED_PROMPTS = [
  {
    icon: <UsersIcon />,
    category: 'Mentorship',
    text: 'How do I find a mentor for backend or AI?',
    note: 'Get pointed to the fastest mentor discovery flow.',
  },
  {
    icon: <BookIcon />,
    category: 'Profile',
    text: 'What should I update in my profile first?',
    note: 'Improve visibility and recommendations faster.',
  },
  {
    icon: <CalendarIcon />,
    category: 'Events',
    text: 'Show me how to find upcoming alumni events.',
    note: 'Navigate events and dashboard calendar more efficiently.',
  },
  {
    icon: <BriefcaseIcon />,
    category: 'Jobs',
    text: 'Where should I look for jobs and opportunities?',
    note: 'Understand jobs, recommendations, and opportunities together.',
  },
];

const QUICK_CHIPS = [
  'How do I connect with alumni?',
  'How do recommendations work here?',
  'What can I do on the dashboard?',
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
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const messageRefs = useRef({});
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await aiApi.history();
        setMessages(res.messages || []);
        setHistory(res.messages || []);
      } catch (e) {
        // Keep the page usable even if history fails to load.
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const messageCountChanged = previousMessageCountRef.current !== messages.length;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: messageCountChanged ? 'smooth' : 'auto',
    });
    previousMessageCountRef.current = messages.length;
  }, [messages.length, typingText, loading]);

  useEffect(() => {
    if (!typingTarget) return undefined;

    if (typingTimer.current) clearInterval(typingTimer.current);
    setTypingText('');

    let index = 0;
    typingTimer.current = setInterval(() => {
      index += 1;
      setTypingText(typingTarget.slice(0, index));
      if (index >= typingTarget.length) {
        clearInterval(typingTimer.current);
        setTypingTarget('');
        setTypingText('');
      }
    }, 12);

    return () => typingTimer.current && clearInterval(typingTimer.current);
  }, [typingTarget]);

  const groupedHistory = useMemo(
    () =>
      history.reduce((groups, msg, index) => {
        const date = formatDate(msg.created_at);
        if (!groups[date]) groups[date] = [];
        groups[date].push({ msg, index });
        return groups;
      }, {}),
    [history]
  );

  const assistantReplyCount = history.filter((item) => item.role === 'assistant').length;

  const focusComposer = () => {
    textareaRef.current?.focus();
  };

  const handleHistoryClick = (index) => {
    const target = messageRefs.current[index];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      messagesContainerRef.current?.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const send = async (customQuestion) => {
    const nextQuestion = customQuestion || question;
    if (!nextQuestion.trim() || loading) return;

    setLoading(true);
    setError('');

    const userMessage = {
      role: 'user',
      content: nextQuestion,
      created_at: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setQuestion('');

    if (textareaRef.current) {
      textareaRef.current.style.height = '56px';
    }

    try {
      const res = await aiApi.chat(nextQuestion.trim());
      const assistantMessage = {
        role: 'assistant',
        content: res.answer,
        created_at: new Date().toISOString(),
      };
      const fullThread = [...nextMessages, assistantMessage];
      setMessages(fullThread);
      setHistory(fullThread);
      setTypingTarget(res.answer);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get response. Please try again.');
    } finally {
      setLoading(false);
      focusComposer();
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
    e.target.style.height = '56px';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  const renderContent = (message, index) => {
    const isLastAssistant =
      message.role === 'assistant' && index === messages.length - 1 && typingTarget;
    const content = isLastAssistant ? typingText || '' : message.content;

    if (message.role === 'assistant') {
      return <ReactMarkdown>{content}</ReactMarkdown>;
    }

    return content;
  };

  return (
    <div className="ai-page">
      <main className="ai-main">
        <header className="ai-header">
          <div className="ai-header-copy">
            <span className="ai-header-kicker">{BOT_NAME}</span>
            <h1>Your AITU and Alumni Network assistant</h1>
            <p>
              Ask about university information, platform navigation, mentors, events,
              jobs, and alumni connections. {BOT_NAME} is continuously enriched by admins
              with information about your university and the platform.
            </p>
          </div>

          <div className="ai-header-side">
            <div className="ai-header-metrics">
              <div className="ai-header-metric">
                <strong>{assistantReplyCount}</strong>
                <span>Replies</span>
              </div>
              <div className="ai-header-metric">
                <strong>{history.length}</strong>
                <span>Messages</span>
              </div>
            </div>

            <button type="button" className="ai-header-button" onClick={focusComposer}>
              Ask a question
            </button>
          </div>
        </header>

        <div ref={messagesContainerRef} className="ai-messages-container">
          {messages.length === 0 ? (
            <section className="ai-welcome">
              <div className="ai-welcome-badge">
                <SparkIcon />
                <span>{BOT_NAME}</span>
              </div>

              <h2>What do you want to figure out today?</h2>
              <p>
                Get fast guidance about AITU and the platform without digging through
                pages manually. The assistant is updated by admins with university-related
                information and platform context.
              </p>

              <div className="ai-suggestions">
                {SUGGESTED_PROMPTS.map((prompt, index) => (
                  <button
                    key={prompt.text}
                    type="button"
                    className="ai-suggestion-card"
                    onClick={() => send(prompt.text)}
                    style={{ animationDelay: `${index * 0.06}s` }}
                  >
                    <div className="ai-suggestion-icon">{prompt.icon}</div>
                    <div className="ai-suggestion-content">
                      <span className="ai-suggestion-category">{prompt.category}</span>
                      <span className="ai-suggestion-text">{prompt.text}</span>
                      <span className="ai-suggestion-note">{prompt.note}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="ai-capability-strip">
                <div className="ai-capability-card">
                  <BookIcon />
                  <div>
                    <strong>Admin-curated university knowledge</strong>
                    <span>Answers can use official university documents and materials uploaded by admins.</span>
                  </div>
                </div>
                <div className="ai-capability-card">
                  <SearchIcon />
                  <div>
                    <strong>Actionable guidance</strong>
                    <span>Best for navigation, feature discovery, and step-by-step help.</span>
                  </div>
                </div>
                <div className="ai-capability-card">
                  <GraduationCapIcon />
                  <div>
                    <strong>Student and alumni focused</strong>
                    <span>Mentors, jobs, events, profile setup, and AITU workflows in one place.</span>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="ai-thread-shell">
              <div className="ai-thread-banner">
                <div>
                  <span className="ai-thread-kicker">Active chat</span>
                  <h2>{BOT_NAME}</h2>
                  <p>Ask follow-up questions naturally. The current thread stays in context.</p>
                </div>
              </div>

              <div className="ai-messages-list">
                {messages.map((message, index) => (
                  <article
                    key={`${message.role}-${message.created_at}-${index}`}
                    ref={(node) => {
                      if (node) messageRefs.current[index] = node;
                    }}
                    className={`ai-message ${message.role}`}
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    <div className="ai-message-avatar">
                      {message.role === 'user' ? <UserIcon /> : <BotIcon />}
                    </div>

                    <div className="ai-message-content">
                      <div className="ai-message-header">
                        <span className="ai-message-author">
                          {message.role === 'user' ? 'You' : BOT_NAME}
                        </span>
                        <span className="ai-message-time">{formatTime(message.created_at)}</span>
                      </div>

                      <div className="ai-message-text">
                        {renderContent(message, index)}
                        {message.role === 'assistant' &&
                          index === messages.length - 1 &&
                          typingTarget && <span className="ai-cursor" />}
                      </div>
                    </div>
                  </article>
                ))}

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
                        <span className="ai-thinking-text">{BOT_NAME} is thinking</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </section>
          )}
        </div>

        {error && (
          <div className="ai-error">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}

        <footer className="ai-composer">
          <div className="ai-composer-tools">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className="ai-quick-chip"
                onClick={() => send(chip)}
                disabled={loading}
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="ai-composer-shell">
            <div className="ai-composer-inner">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={handleTextareaChange}
                onKeyDown={onKey}
                placeholder={`Message ${BOT_NAME} about AITU or the platform...`}
                rows={1}
                disabled={loading}
              />
              <button
                type="button"
                className={`ai-send-btn ${question.trim() ? 'active' : ''}`}
                onClick={() => send()}
                disabled={loading || !question.trim()}
              >
                {loading ? <div className="ai-send-loader" /> : <SendIcon />}
              </button>
            </div>

            <div className="ai-composer-footer">
              <p className="ai-disclaimer">
                {BOT_NAME} responds in English and may use official AITU documents plus platform context.
              </p>
              <span className="ai-composer-shortcut">Enter to send, Shift+Enter for a new line</span>
            </div>
          </div>
        </footer>
      </main>

      <aside className="ai-sidebar">
        <div className="ai-sidebar-header">
          <div className="ai-sidebar-heading">
            <span className="ai-sidebar-kicker">{BOT_NAME}</span>
            <h2>Recent timeline</h2>
            <p>Quickly revisit the last prompts and answers from this thread.</p>
          </div>

          <button type="button" className="ai-sidebar-action" onClick={focusComposer}>
            Ask now
          </button>
        </div>

        <div className="ai-sidebar-summary">
          <div className="ai-sidebar-summary-card">
            <span>Messages</span>
            <strong>{history.length}</strong>
          </div>
          <div className="ai-sidebar-summary-card">
            <span>{BOT_NAME}</span>
            <strong>{assistantReplyCount}</strong>
          </div>
        </div>

        <button
          type="button"
          className="ai-sidebar-toggle"
          onClick={() => setHistoryExpanded((prev) => !prev)}
        >
          <ClockIcon />
          <span>Chat timeline</span>
          <span className="ai-sidebar-count">{history.length}</span>
          <ChevronDownIcon className={historyExpanded ? 'expanded' : ''} />
        </button>

        {historyExpanded && (
          <div className="ai-history-content">
            {Object.keys(groupedHistory).length === 0 ? (
              <div className="ai-history-empty">
                <SparkIcon />
                <span>No messages yet</span>
                <p>Your conversation with {BOT_NAME} will appear here.</p>
              </div>
            ) : (
              Object.entries(groupedHistory).map(([date, items]) => (
                <div key={date} className="ai-history-group">
                  <div className="ai-history-date">{date}</div>
                  {items.map(({ msg, index }) => (
                    <button
                      key={`${msg.role}-${msg.created_at}-${index}`}
                      type="button"
                      className={`ai-history-item ${msg.role}`}
                      onClick={() => handleHistoryClick(index)}
                    >
                      <div className="ai-history-item-icon">
                        {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
                      </div>

                      <div className="ai-history-item-content">
                        <span className="ai-history-item-role">
                          {msg.role === 'user' ? 'You' : BOT_NAME}
                        </span>
                        <p className="ai-history-item-text">
                          {msg.content.length > 72 ? `${msg.content.slice(0, 72)}...` : msg.content}
                        </p>
                        <span className="ai-history-item-time">{formatTime(msg.created_at)}</span>
                      </div>
                    </button>
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

export default AiChat;
