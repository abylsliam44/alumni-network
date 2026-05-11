import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { aiApi } from '../api/ai';
import Icon, { AituGlyph } from '../components/ui/Icon';
import Pill from '../components/ui/Pill';

const BOT_NAME = 'AqyldyAI';

const SUGGESTED_PROMPTS = [
  { icon: 'users', text: 'How do I find a mentor for backend or AI?' },
  { icon: 'doc', text: 'What should I update in my profile first?' },
  { icon: 'calendar', text: 'Show me how to find upcoming alumni events.' },
  { icon: 'briefcase', text: 'Where should I look for jobs and opportunities?' },
];

const QUICK_CHIPS = [
  '@profile',
  '@alumni',
  '@jobs',
  '@events',
];

const formatDateLabel = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const AiChat = () => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typingTarget, setTypingTarget] = useState('');
  const [typingText, setTypingText] = useState('');

  const typingTimer = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await aiApi.history();
        setMessages(res.messages || []);
        setHistory(res.messages || []);
      } catch (e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    const c = messagesContainerRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' });
  }, [messages.length, typingText, loading]);

  useEffect(() => {
    if (!typingTarget) return undefined;
    if (typingTimer.current) clearInterval(typingTimer.current);
    setTypingText(''); let i = 0;
    typingTimer.current = setInterval(() => {
      i += 1;
      setTypingText(typingTarget.slice(0, i));
      if (i >= typingTarget.length) {
        clearInterval(typingTimer.current);
        setTypingTarget(''); setTypingText('');
      }
    }, 12);
    return () => typingTimer.current && clearInterval(typingTimer.current);
  }, [typingTarget]);

  const groupedHistory = useMemo(() => history.reduce((acc, msg) => {
    if (msg.role !== 'user') return acc;
    const date = formatDateLabel(msg.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {}), [history]);

  const focusComposer = () => textareaRef.current?.focus();

  const send = async (custom) => {
    const next = custom || question;
    if (!next.trim() || loading) return;
    setLoading(true); setError('');
    const userMsg = { role: 'user', content: next, created_at: new Date().toISOString() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages); setQuestion('');
    try {
      const res = await aiApi.chat(next.trim());
      const reply = { role: 'assistant', content: res.answer, created_at: new Date().toISOString() };
      const full = [...nextMessages, reply];
      setMessages(full); setHistory(full);
      setTypingTarget(res.answer);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to get response. Try again.');
    } finally { setLoading(false); focusComposer(); }
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const renderContent = (msg, idx) => {
    const isLast = msg.role === 'assistant' && idx === messages.length - 1 && typingTarget;
    const c = isLast ? typingText : msg.content;
    if (msg.role === 'assistant') return <ReactMarkdown>{c}</ReactMarkdown>;
    return c;
  };

  return (
    <div className="ai-page">
      <aside className="ai-history">
        <button
          className="btn primary"
          style={{ marginBottom: 12, justifyContent: 'center' }}
          onClick={() => { setMessages([]); focusComposer(); }}
        >
          <Icon name="plus" size={12} /> New chat
        </button>

        <div className="eyebrow" style={{ padding: '0 8px', marginBottom: 8 }}>HISTORY</div>
        {Object.keys(groupedHistory).length === 0 ? (
          <p className="mute" style={{ fontSize: 11, padding: '0 10px' }}>No history yet.</p>
        ) : (
          Object.entries(groupedHistory).map(([date, msgs]) => (
            <div key={date}>
              <div className="mono mute" style={{ padding: '8px 10px 4px', fontSize: 9.5, letterSpacing: '0.06em' }}>{date.toUpperCase()}</div>
              {msgs.slice(-8).reverse().map((m, i) => (
                <button key={i} className="ai-history-item" type="button" onClick={() => setQuestion(m.content)}>
                  <Icon name="msg" size={12} />
                  <span className="label">{m.content}</span>
                </button>
              ))}
            </div>
          ))
        )}

        <div style={{ marginTop: 'auto', padding: '12px 10px', borderTop: '1px solid var(--line-soft)' }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>KNOWLEDGE BASE</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <div>· Alumni & student profiles</div>
            <div>· Events archive</div>
            <div>· Platform handbook</div>
            <div style={{ color: 'var(--ok)', marginTop: 6 }}>● synced</div>
          </div>
        </div>
      </aside>

      <section className="ai-conv">
        <div ref={messagesContainerRef} className="ai-conv-scroll">
          {messages.length === 0 ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
                <AituGlyph size={48} color="var(--ink-2)" accent="var(--blue)" />
                <div>
                  <div className="h1" style={{ fontSize: 28 }}>{BOT_NAME}</div>
                  <div className="mono mute" style={{ fontSize: 11, marginTop: 4 }}>
                    YOUR CAREER COPILOT · GROUNDED ON ALUMNI KB
                  </div>
                </div>
              </div>

              <h2 className="h2" style={{ marginBottom: 8 }}>What do you want to figure out today?</h2>
              <p className="dim" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24, maxWidth: 600 }}>
                Get fast guidance about the platform, your university, mentors, jobs, and events
                without digging through pages manually.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p.text} type="button"
                    onClick={() => send(p.text)}
                    className="panel"
                    style={{ padding: 14, textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--line-soft)' }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--blue-soft)', border: '1px solid var(--blue-line)', color: 'var(--blue)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                      <Icon name={p.icon} size={14} />
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>{p.text}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((msg, idx) => (
                msg.role === 'user' ? (
                  <div key={`u-${idx}`} className="ai-bubble-user">
                    <div>{renderContent(msg, idx)}</div>
                  </div>
                ) : (
                  <div key={`a-${idx}`} className="ai-bubble-ai">
                    <div className="ai-bubble-ai-glyph">
                      <AituGlyph size={20} color="var(--ink-2)" accent="var(--blue)" />
                    </div>
                    <div className="ai-bubble-ai-content">
                      {renderContent(msg, idx)}
                    </div>
                  </div>
                )
              ))}

              {loading && (
                <div className="ai-bubble-ai">
                  <div className="ai-bubble-ai-glyph">
                    <AituGlyph size={20} color="var(--ink-2)" accent="var(--blue)" />
                  </div>
                  <div className="ai-bubble-ai-content">
                    <span className="pulse-dot" /> <span className="mute">Thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ai-composer-wrap">
          {error && <div className="error-message" style={{ marginBottom: 10 }}>{error}</div>}
          <div className="ai-composer">
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Ask ${BOT_NAME} anything about the platform, alumni, jobs, events…`}
            />
            <div className="ai-composer-bar">
              {QUICK_CHIPS.map((c) => (
                <button key={c} className="chip" type="button" onClick={() => setQuestion((q) => `${q ? `${q.trim()} ` : ''}${c} `)} style={{ cursor: 'pointer' }}>
                  {c}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <span className="mono mute" style={{ fontSize: 10 }}>RAG · ALUMNI KB</span>
              <button className="btn primary sm" onClick={() => send()} disabled={loading || !question.trim()}>
                <Icon name="send" size={12} /> Send
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AiChat;
