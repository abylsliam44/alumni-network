import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { messagesApi } from '../api/messages';
import { connectionsApi } from '../api/connections';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { useChatSocket } from '../hooks/useChatSocket';

const getInitials = (name = '') => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
};

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const timeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday ? 'Today' : date.toLocaleDateString();
};

const Messages = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesById, setMessagesById] = useState({});
  const [draft, setDraft] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingState, setTypingState] = useState({});
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const typingTimeout = useRef(null);
  const sendEventRef = useRef(() => {});
  const [friendIds, setFriendIds] = useState([]);
  const [friends, setFriends] = useState([]);

  const currentMessages = messagesById[activeId]?.messages || [];

  const handleNewMessage = useCallback(
    ({ conversation_id, message }) => {
      setMessagesById((prev) => {
        const existing = prev[conversation_id]?.messages || [];
        if (existing.find((m) => m.id === message.id)) return prev;
        return {
          ...prev,
          [conversation_id]: {
            ...prev[conversation_id],
            messages: [...existing, message],
            has_more: prev[conversation_id]?.has_more ?? false,
          },
        };
      });

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.conversation_id === conversation_id
            ? {
                ...c,
                last_message: message,
                unread_count:
                  activeId === conversation_id || message.sender_id === user?.id
                    ? 0
                    : (c.unread_count || 0) + 1,
              }
            : c
        );

        const exists = updated.some((c) => c.conversation_id === conversation_id);
        if (!exists) {
          updated.unshift({
            conversation_id,
            other_user: null,
            last_message: message,
            unread_count: message.sender_id === user?.id ? 0 : 1,
          });
        }
        return [...updated].sort((a, b) => {
          const aTime = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
          const bTime = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
          return bTime - aTime;
        });
      });

      if (conversation_id === activeId && message.sender_id !== user?.id) {
        messagesApi.markRead(conversation_id, message.id).catch(() => {});
        sendEventRef.current('message_read', {
          conversation_id,
          last_read_message_id: message.id,
        });
      }
    },
    [activeId, user?.id]
  );

  const handleTypingEvent = useCallback(
    ({ conversation_id, user_id, type }) => {
      if (!conversation_id || !user_id || user_id === user?.id) return;
      setTypingState((prev) => ({
        ...prev,
        [conversation_id]: type === 'typing_start' ? user_id : null,
      }));
    },
    [user?.id]
  );

  const handleMessageRead = useCallback(
    ({ conversation_id, last_read_message_id, user_id }) => {
      if (!conversation_id || !last_read_message_id || user_id === user?.id) return;
      setMessagesById((prev) => {
        const bucket = prev[conversation_id];
        if (!bucket?.messages) return prev;
        const pivot = bucket.messages.find((m) => m.id === last_read_message_id);
        if (!pivot) return prev;
        const updated = bucket.messages.map((msg) => {
          if (msg.sender_id === user?.id && new Date(msg.created_at) <= new Date(pivot.created_at)) {
            return { ...msg, is_read: true, read_at: msg.read_at || pivot.read_at };
          }
          return msg;
        });
        return { ...prev, [conversation_id]: { ...bucket, messages: updated } };
      });
    },
    [user?.id]
  );

  const { status: socketStatus, sendEvent } = useChatSocket({
    onNewMessage: handleNewMessage,
    onTypingEvent: handleTypingEvent,
    onMessageRead: handleMessageRead,
  });

  useEffect(() => {
    sendEventRef.current = sendEvent;
  }, [sendEvent]);

  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvos(true);
      const data = await messagesApi.listConversations();
      setConversations(data);
      if (!activeId && data.length) {
        setActiveId(data[0].conversation_id);
      }
    } finally {
      setLoadingConvos(false);
    }
  }, [activeId]);

  const fetchMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) return;
      try {
        setLoadingMessages(true);
        const data = await messagesApi.getConversationMessages(conversationId);
        setMessagesById((prev) => ({
          ...prev,
          [conversationId]: {
            messages: data.messages || [],
            has_more: data.has_more,
          },
        }));

        const lastFromOther = [...(data.messages || [])]
          .reverse()
          .find((m) => m.sender_id !== user?.id);
        if (lastFromOther) {
          await messagesApi.markRead(conversationId, lastFromOther.id);
          sendEvent('message_read', {
            conversation_id: conversationId,
            last_read_message_id: lastFromOther.id,
          });
          setConversations((prev) =>
            prev.map((c) =>
              c.conversation_id === conversationId ? { ...c, unread_count: 0 } : c
            )
          );
        }
      } finally {
        setLoadingMessages(false);
      }
    },
    [sendEvent, user?.id]
  );

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('chat');
    if (chatId) {
      setActiveId(chatId);
      if (window.innerWidth < 900) setMobileView('chat');
    }
  }, [location.search]);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const data = await connectionsApi.friends();
        const ids = data.friends.map((f) => f.user.id);
        setFriendIds(ids);
        setFriends(data.friends);
      } catch (err) {
        console.error('Failed to load friends', err);
      }
    };
    loadFriends();
  }, []);

  useEffect(() => {
    if (activeId && !messagesById[activeId]) {
      fetchMessages(activeId);
    }
    if (activeId && window.innerWidth < 900) {
      setMobileView('chat');
    }
  }, [activeId, fetchMessages, messagesById]);

  const combinedConversations = useMemo(() => {
    const map = new Map();
    conversations.forEach((c) => {
      const key = c.other_user?.id || c.conversation_id;
      map.set(key, c);
    });
    friends.forEach((f) => {
      const key = f.user.id;
      if (!map.has(key)) {
        map.set(key, {
          conversation_id: null,
          other_user: {
            id: f.user.id,
            name: f.user.name,
            photo_url: f.user.photo_url,
            role: f.user.role,
            is_mentor: f.user.is_mentor,
          },
          last_message: null,
          unread_count: 0,
          is_virtual: true,
        });
      }
    });
    return Array.from(map.values());
  }, [conversations, friends]);

  const filteredConversations = useMemo(() => {
    const term = search.toLowerCase();
    return combinedConversations.filter((c) =>
      term
        ? (c.other_user?.name || 'Conversation').toLowerCase().includes(term)
        : true
    );
  }, [combinedConversations, search]);

  const openConversation = async (c) => {
    if (c.conversation_id) {
      setActiveId(c.conversation_id);
      setMobileView('chat');
      return;
    }
    if (c.other_user?.id) {
      try {
        const convo = await messagesApi.startConversation(c.other_user.id);
        await fetchConversations();
        setActiveId(convo.conversation_id);
        setMobileView('chat');
      } catch (err) {
        console.error('Failed to start conversation', err);
      }
    }
  };

  const handleSend = () => {
    if (!draft.trim() || !activeId) return;
    if (!canMessage) return;
    sendEvent('send_message', {
      conversation_id: activeId,
      text: draft.trim(),
    });
    setDraft('');
    sendEvent('typing_stop', { conversation_id: activeId });
  };

  const handleDraftChange = (value) => {
    setDraft(value);
    if (!activeId) return;
    if (!canMessage) return;
    sendEvent('typing_start', { conversation_id: activeId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      sendEvent('typing_stop', { conversation_id: activeId });
    }, 1200);
  };

  const showTyping = typingState[activeId];
  const lastOutgoing = [...currentMessages].reverse().find((m) => m.sender_id === user?.id);
  const activeConversation = conversations.find((c) => c.conversation_id === activeId);
  const otherUser = activeConversation?.other_user;
  const canMessage = otherUser ? friendIds.includes(otherUser.id) : false;

  return (
    <div className="page messages-page light">
      <div className="page-header messages-header">
        <div className="header-text">
          <h1>Messages</h1>
          <p>Stay connected with mentors, students, and alumni.</p>
        </div>
        <div className="ws-status" title={socketStatus === 'connected' ? 'Connected' : 'Connecting'}>
          <span className={`status-dot ${socketStatus === 'connected' ? 'online' : 'offline'}`} />
        </div>
      </div>

      <div className={`messages-grid ${mobileView === 'list' ? 'show-list' : 'show-chat'}`}>
        <Card className="convo-panel">
          <div className="convo-header">
            <Input
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="convo-scroll">
            {loadingConvos ? (
              <div className="skeleton-list">
                {[...Array(4)].map((_, idx) => (
                  <div key={idx} className="skeleton-line" />
                ))}
              </div>
            ) : filteredConversations.length ? (
              filteredConversations.map((c) => {
                const isActive = c.conversation_id === activeId;
                const other = c.other_user;
                return (
                  <button
                    key={c.conversation_id}
                    className={`convo-item ${isActive ? 'active' : ''}`}
                    onClick={() => openConversation(c)}
                  >
                    <div className="convo-avatar">{getInitials(other?.name || 'C')}</div>
                    <div className="convo-body">
                      <div className="convo-top">
                        <div className="convo-name">{other?.name || 'Conversation'}</div>
                        <div className="convo-meta">
                          {c.last_message?.created_at && formatTime(c.last_message.created_at)}
                          {c.unread_count > 0 && <span className="pill unread">{c.unread_count}</span>}
                        </div>
                      </div>
                      <div className="convo-role">
                        {other?.is_mentor ? 'Mentor' : other?.role || 'Member'}
                      </div>
                      <div className="convo-snippet">
                        {c.last_message?.text || 'Start the conversation'}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="empty-state">
                <p>You have no conversations yet.</p>
                <span>Find a mentor or connect with alumni to start chatting.</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="chat-panel">
          {activeId ? (
            <>
              <div className="chat-header">
                <div>
                  <div className="chat-title">
                    {conversations.find((c) => c.conversation_id === activeId)?.other_user?.name ||
                      'Conversation'}
                  </div>
                  <div className="chat-subtitle">
                    {conversations.find((c) => c.conversation_id === activeId)?.other_user?.role ||
                      'Alumni Network'}
                  </div>
                </div>
                <div className="chat-actions">
                  {mobileView === 'chat' && (
                    <Button variant="secondary" onClick={() => setMobileView('list')}>
                      Back
                    </Button>
                  )}
                </div>
              </div>

              <div className="chat-body">
                {loadingMessages ? (
                  <div className="skeleton-list">
                    {[...Array(5)].map((_, idx) => (
                      <div key={idx} className="skeleton-bubble" />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="message-list">
                      {currentMessages.map((msg, idx) => {
                        const prev = currentMessages[idx - 1];
                        const showDivider =
                          !prev || timeLabel(prev.created_at) !== timeLabel(msg.created_at);
                        const isOwn = msg.sender_id === user?.id;
                        return (
                          <div key={msg.id || idx} className="message-row">
                            {showDivider && <div className="date-divider">{timeLabel(msg.created_at)}</div>}
                            <div className={`bubble ${isOwn ? 'outgoing' : 'incoming'}`}>
                              <div className="bubble-text">{msg.text}</div>
                              <div className="bubble-meta">
                                <span>{formatTime(msg.created_at)}</span>
                                {isOwn && msg.is_read && <span className="seen-tag">Seen</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {showTyping && (
                      <div className="typing-indicator">
                        <span className="dot" />
                        <span className="dot" />
                        <span className="dot" />
                        <span>Typing...</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="chat-composer">
                <textarea
                  rows={1}
                  maxLength={500}
                  value={draft}
                  placeholder="Type your message…"
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={!canMessage}
                />
                <Button variant="primary" onClick={handleSend} disabled={!draft.trim() || !canMessage}>
                  Send
                </Button>
              </div>
              {!canMessage && (
                <div className="read-receipt">Messaging is available only for friends. Send a friend request first.</div>
              )}
              {lastOutgoing?.is_read && canMessage && <div className="read-receipt">Seen by recipient</div>}
            </>
          ) : (
            <div className="empty-chat">
              <h3>Select a conversation</h3>
              <p>Choose a chat to view messages or start a new one.</p>
            </div>
          )}
        </Card>

        {activeId && (
          <Card className="info-panel">
            <div className="info-avatar">{getInitials(otherUser?.name || 'C')}</div>
            <div className="info-name">{otherUser?.name || 'Conversation'}</div>
            <div className="info-role">{otherUser?.is_mentor ? 'Mentor' : otherUser?.role || 'Member'}</div>
            <div className="info-actions">
              <Button
                variant="primary"
                onClick={() => {
                  if (otherUser?.id) navigate(`/profile/${otherUser.id}`);
                }}
              >
                View profile
              </Button>
              <Button variant="secondary">Add note</Button>
            </div>
            <div className="info-meta">
              <div className="info-row">
                <span className="label">Status</span>
                <span className="value">Active</span>
              </div>
              <div className="info-row">
                <span className="label">Last message</span>
                <span className="value">
                  {activeConversation?.last_message?.created_at
                    ? timeLabel(activeConversation.last_message.created_at)
                    : '—'}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Messages;

