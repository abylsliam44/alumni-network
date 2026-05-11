import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { messagesApi } from '../api/messages';
import { videocallApi } from '../api/videocall';
import { connectionsApi } from '../api/connections';
import { useAuth } from '../hooks/useAuth';
import { useChatSocket } from '../hooks/useChatSocket';
import Avatar from '../components/ui/Avatar';
import Icon from '../components/ui/Icon';
import { resolveUrl } from '../utils/image';

const apiBase = import.meta.env.VITE_API_URL || '';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const ATTACHMENT_ACCEPT =
  'image/*,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';

const formatTime = (v) => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
const formatDateLabel = (v) => {
  if (!v) return '';
  const d = new Date(v);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};
const formatRelative = (v) => {
  if (!v) return 'Offline';
  const d = new Date(v);
  const m = Math.max(1, Math.floor((Date.now() - d.getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

const isImage = (m) => m?.startsWith('image/');
const isVideo = (m) => m?.startsWith('video/');
const isAudio = (m) => m?.startsWith('audio/');

const previewLabel = (msg) => {
  if (!msg?.attachment_url) return msg?.text || '';
  if (isImage(msg.attachment_mime_type)) return 'Photo';
  if (isVideo(msg.attachment_mime_type)) return 'Video';
  if (isAudio(msg.attachment_mime_type)) return 'Audio';
  return msg.attachment_name || 'File';
};

const previewText = (msg) => {
  if (!msg) return 'Start a conversation';
  if (msg.text?.startsWith('JOIN_VIDEO_CALL|')) return 'Video call';
  if (msg.attachment_url) {
    const label = previewLabel(msg);
    return msg.text?.trim() ? `📎 ${label} · ${msg.text}` : `📎 ${label}`;
  }
  return msg.text || 'Start a conversation';
};

const attachmentDownloadUrl = (msg, download = false) => {
  if (!msg?.id) return '';
  const base = apiBase?.replace(/\/$/, '') || '';
  const path = `/api/v1/messages/attachments/${msg.id}/download`;
  const params = new URLSearchParams();
  if (download) params.set('download', 'true');
  const q = params.toString();
  return `${base}${path}${q ? `?${q}` : ''}`;
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
  const [search, setSearch] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [friendIds, setFriendIds] = useState([]);
  const [friends, setFriends] = useState([]);
  const [presenceByUser, setPresenceByUser] = useState({});
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [typingState, setTypingState] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const typingTimeout = useRef(null);
  const sendEventRef = useRef(() => {});

  const currentMessages = messagesById[activeId]?.messages || [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentMessages]);

  const handleNewMessage = useCallback(({ conversation_id, message }) => {
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
          ? { ...c, last_message: message, unread_count: activeId === conversation_id || message.sender_id === user?.id ? 0 : (c.unread_count || 0) + 1 }
          : c,
      );
      const exists = updated.some((c) => c.conversation_id === conversation_id);
      if (!exists) {
        updated.unshift({
          conversation_id, other_user: null, last_message: message,
          unread_count: message.sender_id === user?.id ? 0 : 1,
        });
      }
      return [...updated].sort((a, b) => {
        const aT = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
        const bT = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
        return bT - aT;
      });
    });
    if (conversation_id === activeId && message.sender_id !== user?.id) {
      messagesApi.markRead(conversation_id, message.id).catch(() => {});
      sendEventRef.current('message_read', { conversation_id, last_read_message_id: message.id });
    }
  }, [activeId, user?.id]);

  const handleTypingEvent = useCallback(({ conversation_id, user_id, type }) => {
    if (!conversation_id || !user_id || user_id === user?.id) return;
    setTypingState((p) => ({ ...p, [conversation_id]: type === 'typing_start' ? user_id : null }));
  }, [user?.id]);

  const handleMessageRead = useCallback(({ conversation_id, last_read_message_id, user_id }) => {
    if (!conversation_id || !last_read_message_id || user_id === user?.id) return;
    setMessagesById((prev) => {
      const bucket = prev[conversation_id]; if (!bucket?.messages) return prev;
      const pivot = bucket.messages.find((m) => m.id === last_read_message_id); if (!pivot) return prev;
      const updated = bucket.messages.map((msg) => {
        if (msg.sender_id === user?.id && new Date(msg.created_at) <= new Date(pivot.created_at)) {
          return { ...msg, is_read: true, read_at: msg.read_at || pivot.read_at };
        }
        return msg;
      });
      return { ...prev, [conversation_id]: { ...bucket, messages: updated } };
    });
  }, [user?.id]);

  const handlePresenceEvent = useCallback(({ user_id, is_online, last_seen }) => {
    if (!user_id) return;
    setPresenceByUser((p) => ({ ...p, [user_id]: { isOnline: Boolean(is_online), lastSeen: last_seen || p[user_id]?.lastSeen || null } }));
  }, []);

  const handleOnlineUsers = useCallback(({ user_ids, users }) => {
    setPresenceByUser((p) => {
      const next = { ...p };
      if (Array.isArray(users) && users.length) {
        users.forEach((e) => { if (e?.user_id) next[e.user_id] = { isOnline: Boolean(e.is_online), lastSeen: e.last_seen || next[e.user_id]?.lastSeen || null }; });
        return next;
      }
      if (Array.isArray(user_ids)) user_ids.forEach((id) => { next[id] = { isOnline: true, lastSeen: next[id]?.lastSeen || null }; });
      return next;
    });
  }, []);

  const { sendEvent } = useChatSocket({
    onNewMessage: handleNewMessage,
    onTypingEvent: handleTypingEvent,
    onMessageRead: handleMessageRead,
    onPresenceEvent: handlePresenceEvent,
    onOnlineUsers: handleOnlineUsers,
  });

  useEffect(() => { sendEventRef.current = sendEvent; }, [sendEvent]);

  const fetchConversations = useCallback(async () => {
    try {
      setLoadingConvos(true);
      const data = await messagesApi.listConversations();
      setConversations(data);
      if (!activeId && data.length) setActiveId(data[0].conversation_id);
    } finally { setLoadingConvos(false); }
  }, [activeId]);

  const fetchMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await messagesApi.getConversationMessages(id);
      setMessagesById((p) => ({ ...p, [id]: { messages: data.messages || [], has_more: data.has_more } }));
      const lastFromOther = [...(data.messages || [])].reverse().find((m) => m.sender_id !== user?.id);
      if (lastFromOther) {
        await messagesApi.markRead(id, lastFromOther.id);
        sendEvent('message_read', { conversation_id: id, last_read_message_id: lastFromOther.id });
        setConversations((p) => p.map((c) => c.conversation_id === id ? { ...c, unread_count: 0 } : c));
      }
    } catch (err) { console.error(err); }
  }, [sendEvent, user?.id]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const chatId = params.get('chat') || params.get('conversation');
    if (chatId) setActiveId(chatId);
  }, [location.search]);

  useEffect(() => {
    if (!activeId) return;
    const params = new URLSearchParams(location.search);
    const currentChat = params.get('chat');
    if (currentChat === activeId && !params.get('conversation')) return;
    params.set('chat', activeId); params.delete('conversation');
    navigate({ pathname: location.pathname, search: `?${params.toString()}` }, { replace: true });
  }, [activeId, location.pathname, location.search, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const data = await connectionsApi.friends();
        setFriendIds(data.friends.map((f) => f.user.id));
        setFriends(data.friends);
      } catch (err) { console.error(err); }
    })();
  }, []);

  useEffect(() => { if (activeId && !messagesById[activeId]) fetchMessages(activeId); }, [activeId, fetchMessages, messagesById]);

  const combinedConversations = useMemo(() => {
    const map = new Map();
    conversations.forEach((c) => map.set(c.other_user?.id || c.conversation_id, c));
    friends.forEach((f) => {
      if (!map.has(f.user.id)) {
        map.set(f.user.id, {
          conversation_id: null,
          other_user: { id: f.user.id, name: f.user.name, photo_url: f.user.photo_url, role: f.user.role, is_mentor: f.user.is_mentor },
          last_message: null, unread_count: 0, is_virtual: true,
        });
      }
    });
    return Array.from(map.values());
  }, [conversations, friends]);

  const filteredConversations = useMemo(() => {
    const term = search.toLowerCase();
    return combinedConversations.filter((c) =>
      term ? (c.other_user?.name || 'Conversation').toLowerCase().includes(term) : true,
    );
  }, [combinedConversations, search]);

  const openConversation = async (c) => {
    if (c.conversation_id) { setActiveId(c.conversation_id); return; }
    if (c.other_user?.id) {
      try {
        const convo = await messagesApi.startConversation(c.other_user.id);
        await fetchConversations();
        setActiveId(convo.conversation_id);
      } catch (err) { console.error(err); }
    }
  };

  const activeConversation = conversations.find((c) => c.conversation_id === activeId);
  const otherUser = activeConversation?.other_user;
  const canMessage = otherUser ? friendIds.includes(otherUser.id) : false;
  const otherPresence = otherUser ? presenceByUser[otherUser.id] : null;
  const otherPresenceLabel = typingState[activeId]
    ? 'Typing…'
    : otherPresence?.isOnline ? 'Active now' : otherPresence?.lastSeen ? `Last seen ${formatRelative(otherPresence.lastSeen)}` : 'Offline';
  const canSendMessage = Boolean(draft.trim() || selectedAttachment);

  const handleAttachmentSelect = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > MAX_ATTACHMENT_SIZE) {
      alert('File is too large. Maximum size is 25 MB.');
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      return;
    }
    setSelectedAttachment(f);
  };

  const clearAttachment = () => {
    setSelectedAttachment(null);
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!activeId || !canSendMessage || uploadingAttachment || !canMessage) return;
    const text = draft.trim();
    try {
      let payload = null;
      if (selectedAttachment) {
        setUploadingAttachment(true);
        const upload = await messagesApi.uploadAttachment(selectedAttachment);
        payload = {
          attachment_url: upload.file_url,
          attachment_name: selectedAttachment.name,
          attachment_mime_type: selectedAttachment.type || 'application/octet-stream',
          attachment_size: selectedAttachment.size,
        };
      }
      const message = await messagesApi.sendMessage(activeId, { text, ...(payload || {}) });
      handleNewMessage({ conversation_id: activeId, message });
      setDraft(''); clearAttachment();
      sendEvent('typing_stop', { conversation_id: activeId });
    } catch (err) { console.error(err); alert('Failed to send. Try again.'); }
    finally { setUploadingAttachment(false); }
  };

  const handleDraftChange = (v) => {
    setDraft(v);
    if (!activeId || !canMessage) return;
    sendEvent('typing_start', { conversation_id: activeId });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendEvent('typing_stop', { conversation_id: activeId }), 1200);
  };

  const startVideoCall = async () => {
    if (!activeId || !canMessage || isStartingCall) return;
    try {
      setIsStartingCall(true);
      const data = await videocallApi.createRoom(activeId);
      navigate(`/video-call/${encodeURIComponent(data.room_name)}?conversation=${activeId}`, {
        state: { from: `/messages?chat=${activeId}` },
      });
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.detail || 'Failed to start video call');
    } finally { setIsStartingCall(false); }
  };

  const joinVideoCall = (roomName) => {
    navigate(`/video-call/${encodeURIComponent(roomName)}?conversation=${activeId}`, {
      state: { from: `/messages?chat=${activeId}` },
    });
  };

  const grouped = useMemo(() => {
    const out = []; let cur = null;
    currentMessages.forEach((m) => {
      const d = formatDateLabel(m.created_at);
      if (d !== cur) { cur = d; out.push({ type: 'date', date: d }); }
      out.push({ type: 'msg', data: m });
    });
    return out;
  }, [currentMessages]);

  return (
    <div className={`messages-page${activeId ? ' has-active' : ''}`}>
      <aside className="messages-list">
        <div className="messages-list-head">
          <h1 className="h2">Messages</h1>
          <div className="messages-list-search">
            <Icon name="search" size={14} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" />
          </div>
        </div>
        <div className="messages-list-scroll">
          {loadingConvos ? (
            <div className="loading-block inline">Syncing inbox…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="empty-block" style={{ padding: 30 }}>
              <Icon name="msg" size={24} />
              <h3>No conversations</h3>
              <p>Connect with someone to start chatting.</p>
            </div>
          ) : filteredConversations.map((c) => {
            const u = c.other_user;
            const last = c.last_message;
            const isActive = c.conversation_id === activeId;
            const unread = c.unread_count > 0;
            const isOnline = u?.id && presenceByUser[u.id]?.isOnline;
            return (
              <div
                key={c.conversation_id || `virtual-${u?.id}`}
                className={`messages-conv ${isActive ? 'active' : ''} ${unread ? 'unread' : ''}`}
                onClick={() => openConversation(c)}
              >
                <div style={{ position: 'relative' }}>
                  <Avatar src={resolveUrl(u?.photo_url)} name={u?.name || 'Conversation'} size="m" />
                  {isOnline && (
                    <span style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--ok)', border: '2px solid var(--bg)' }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{u?.name || 'Conversation'}</div>
                  <div className="preview">{previewText(last)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {last?.created_at && <div className="time">{formatTime(last.created_at)}</div>}
                  {unread && <div className="unread-dot" style={{ marginLeft: 'auto', marginTop: 4 }} />}
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="messages-thread">
        {!activeId ? (
          <div className="empty-block" style={{ flex: 1 }}>
            <Icon name="msg" size={32} />
            <h3>Select a conversation</h3>
            <p>Choose from your existing conversations on the left.</p>
          </div>
        ) : (
          <>
            <div className="messages-thread-head">
              <button className="iconbtn mobile-only messages-mobile-back" onClick={() => setActiveId(null)} title="Back to conversations">
                <Icon name="chevronL" size={16} />
              </button>
              <Avatar src={resolveUrl(otherUser?.photo_url)} name={otherUser?.name} size="m" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="h3">{otherUser?.name || 'Conversation'}</div>
                <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
                  {otherPresenceLabel.toUpperCase()}
                </div>
              </div>
              <button className="iconbtn" onClick={startVideoCall} disabled={!canMessage || isStartingCall} title="Start video call">
                <Icon name="video" size={16} />
              </button>
              <button className="iconbtn" onClick={() => otherUser && navigate(`/profile/${otherUser.id}`)} title="View profile">
                <Icon name="user" size={16} />
              </button>
            </div>

            <div className="messages-thread-scroll">
              {grouped.map((g, i) => g.type === 'date' ? (
                <div key={`d-${i}`} className="mono mute" style={{ alignSelf: 'center', fontSize: 10, padding: '8px 0' }}>{g.date.toUpperCase()}</div>
              ) : (
                <Bubble key={g.data.id} msg={g.data} isMine={g.data.sender_id === user?.id} onJoinCall={joinVideoCall} />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {canMessage ? (
              <div className="messages-composer">
                <input
                  type="file" ref={attachmentInputRef} accept={ATTACHMENT_ACCEPT}
                  style={{ display: 'none' }} onChange={handleAttachmentSelect}
                />
                <button className="iconbtn" onClick={() => attachmentInputRef.current?.click()} title="Attach file">
                  <Icon name="paperclip" size={16} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => handleDraftChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Type a message…"
                />
                <button className="btn primary" onClick={handleSend} disabled={!canSendMessage || uploadingAttachment}>
                  <Icon name="send" size={14} />
                </button>
                {selectedAttachment && (
                  <div style={{ position: 'absolute', bottom: 70, left: 56, right: 56, padding: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon name="paperclip" size={14} />
                    <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedAttachment.name}</span>
                    <button className="iconbtn" onClick={clearAttachment}><Icon name="close" size={12} /></button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: 16, borderTop: '1px solid var(--line-soft)', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12.5 }}>
                Connect with this person to start messaging.
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

const Bubble = ({ msg, isMine, onJoinCall }) => {
  if (msg.text?.startsWith('JOIN_VIDEO_CALL|')) {
    const room = msg.text.split('|')[1];
    return (
      <div className={`messages-bubble ${isMine ? 'out' : 'in'}`} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="video" size={14} />
          <strong>Video call</strong>
        </div>
        <button className="btn sm primary" onClick={() => onJoinCall(room)}>Join call</button>
      </div>
    );
  }
  return (
    <>
      <div className={`messages-bubble ${isMine ? 'out' : 'in'}`}>
        {msg.attachment_url && <Attachment msg={msg} />}
        {msg.text && <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
      </div>
      <div className={`messages-bubble-meta ${isMine ? 'out' : ''}`}>
        {formatTime(msg.created_at)}
        {isMine && msg.is_read && <span style={{ marginLeft: 6 }}>· read</span>}
      </div>
    </>
  );
};

const Attachment = ({ msg }) => {
  const url = attachmentDownloadUrl(msg);
  if (isImage(msg.attachment_mime_type)) {
    return <img src={url} alt={msg.attachment_name || ''} style={{ maxWidth: 320, borderRadius: 8, marginBottom: 6, display: 'block' }} />;
  }
  if (isVideo(msg.attachment_mime_type)) {
    return <video src={url} controls style={{ maxWidth: 360, borderRadius: 8, marginBottom: 6, display: 'block' }} />;
  }
  if (isAudio(msg.attachment_mime_type)) {
    return <audio src={url} controls style={{ width: 240, marginBottom: 6, display: 'block' }} />;
  }
  return (
    <a href={attachmentDownloadUrl(msg, true)} target="_blank" rel="noopener noreferrer" className="chip" style={{ textDecoration: 'none', color: 'inherit', marginBottom: 6, display: 'inline-flex' }}>
      <Icon name="paperclip" size={12} /> {msg.attachment_name || 'Attachment'}
    </a>
  );
};

export default Messages;
