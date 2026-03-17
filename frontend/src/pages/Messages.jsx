import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { messagesApi } from '../api/messages';
import { videocallApi } from '../api/videocall';
import { connectionsApi } from '../api/connections';
import { useAuth } from '../hooks/useAuth';
import { useChatSocket } from '../hooks/useChatSocket';
import VideoCallModal from '../components/VideoCallModal';

import { resolveUrl } from '../utils/image';

const apiBase = import.meta.env.VITE_API_URL || '';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const ATTACHMENT_ACCEPT =
  'image/*,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip';


const dicebear = (name = 'User') =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
  });
};

const timeLabel = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  return isToday ? 'Today' : date.toLocaleDateString();
};

const isImageAttachment = (mimeType) => mimeType?.startsWith('image/');
const isVideoAttachment = (mimeType) => mimeType?.startsWith('video/');
const isAudioAttachment = (mimeType) => mimeType?.startsWith('audio/');

const formatAttachmentSize = (size) => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const attachmentPreviewLabel = (message) => {
  if (!message?.attachment_url) return message?.text || '';
  if (isImageAttachment(message.attachment_mime_type)) return 'Photo';
  if (isVideoAttachment(message.attachment_mime_type)) return 'Video';
  if (isAudioAttachment(message.attachment_mime_type)) return 'Audio';
  return message.attachment_name || 'File';
};

const conversationPreviewText = (message) => {
  if (!message) return 'Start a conversation';
  if (message.text?.startsWith('JOIN_VIDEO_CALL|')) return '📹 Video Call';
  if (message.attachment_url) {
    const label = attachmentPreviewLabel(message);
    return message.text?.trim() ? `📎 ${label} · ${message.text}` : `📎 ${label}`;
  }
  return message.text || 'Start a conversation';
};

const attachmentAccessUrl = (message, download = false) => {
  if (!message?.id) return '';
  const base = apiBase?.replace(/\/$/, '') || '';
  const path = `/api/v1/messages/attachments/${message.id}/download`;
  const params = new URLSearchParams();
  const token = localStorage.getItem('token');
  if (download) params.set('download', 'true');
  if (token) params.set('token', token);
  const query = params.toString();
  return `${base}${path}${query ? `?${query}` : ''}`;
};

// Icons
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const VideoIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const MoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

const SmileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);

const PaperclipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MessageCircleIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CheckCheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 6 9 17 4 12" />
    <polyline points="22 10 13 21 11 19" />
  </svg>
);

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
  const [selectedAttachment, setSelectedAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const typingTimeout = useRef(null);
  const sendEventRef = useRef(() => { });
  const [friendIds, setFriendIds] = useState([]);
  const [friends, setFriends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const attachmentInputRef = useRef(null);

  // Video call state
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [videoCallData, setVideoCallData] = useState({ livekitUrl: '', token: '' });
  const [isStartingCall, setIsStartingCall] = useState(false);

  const currentMessages = messagesById[activeId]?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages]);

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
        messagesApi.markRead(conversation_id, message.id).catch(() => { });
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

  // Handle presence updates (user goes online/offline)
  const handlePresenceEvent = useCallback(
    ({ user_id, is_online }) => {
      if (!user_id) return;
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        if (is_online) {
          newSet.add(user_id);
        } else {
          newSet.delete(user_id);
        }
        return newSet;
      });
    },
    []
  );

  // Handle initial list of online friends when connecting
  const handleOnlineUsers = useCallback(
    ({ user_ids }) => {
      if (!user_ids) return;
      setOnlineUsers(new Set(user_ids));
    },
    []
  );

  const { status: socketStatus, sendEvent } = useChatSocket({
    onNewMessage: handleNewMessage,
    onTypingEvent: handleTypingEvent,
    onMessageRead: handleMessageRead,
    onPresenceEvent: handlePresenceEvent,
    onOnlineUsers: handleOnlineUsers,
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

  const handleTextareaChange = (e) => {
    handleDraftChange(e.target.value);
    // Auto-resize textarea
    e.target.style.height = '48px';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  const showTyping = typingState[activeId];
  const activeConversation = conversations.find((c) => c.conversation_id === activeId);
  const otherUser = activeConversation?.other_user;
  const otherUserAvatar = resolveUrl(otherUser?.photo_url) || dicebear(otherUser?.name);
  const canMessage = otherUser ? friendIds.includes(otherUser.id) : false;
  const isOtherUserOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const canSendMessage = Boolean(draft.trim() || selectedAttachment);
  const sharedMediaMessages = useMemo(
    () =>
      currentMessages
        .filter((msg) => msg.attachment_url)
        .slice()
        .reverse(),
    [currentMessages]
  );

  const clearSelectedAttachment = useCallback(() => {
    setSelectedAttachment(null);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  }, []);

  const uploadAttachment = useCallback(async (file) => {
    const contentType = file.type || 'application/octet-stream';
    const upload = await messagesApi.uploadAttachment(file);

    return {
      attachment_url: upload.file_url,
      attachment_name: file.name,
      attachment_mime_type: contentType,
      attachment_size: file.size,
    };
  }, []);

  const handleAttachmentSelect = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_ATTACHMENT_SIZE) {
        alert('File is too large. Maximum size is 25 MB.');
        clearSelectedAttachment();
        return;
      }

      setSelectedAttachment(file);
    },
    [clearSelectedAttachment]
  );

  const handleSend = async () => {
    if (!activeId || !canSendMessage || uploadingAttachment) return;
    if (!canMessage) return;

    const messageText = draft.trim();

    try {
      let attachmentPayload = null;

      if (selectedAttachment) {
        setUploadingAttachment(true);
        attachmentPayload = await uploadAttachment(selectedAttachment);
      }

      const message = await messagesApi.sendMessage(activeId, {
        text: messageText,
        ...(attachmentPayload || {}),
      });
      handleNewMessage({
        conversation_id: activeId,
        message,
      });

      setDraft('');
      clearSelectedAttachment();
      sendEvent('typing_stop', { conversation_id: activeId });
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
    } catch (error) {
      console.error('Failed to send message with attachment', error);
      alert('Failed to send attachment. Please try again.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Video call handler
  const startVideoCall = async () => {
    if (!activeId || !canMessage || isStartingCall) return;

    try {
      setIsStartingCall(true);
      const data = await videocallApi.createRoom(activeId);
      setVideoCallData({
        livekitUrl: data.livekit_url,
        token: data.token,
      });
      setIsVideoCallOpen(true);
    } catch (err) {
      console.error('Failed to start video call:', err);
      const msg = err?.response?.data?.detail || err?.message || 'Неизвестная ошибка';
      alert(`Не удалось начать видеозвонок: ${msg}`);
    } finally {
      setIsStartingCall(false);
    }
  };

  // Join video call handler
  const joinVideoCall = async (roomName) => {
    if (!roomName || isStartingCall) return;

    try {
      setIsStartingCall(true);
      const data = await videocallApi.joinRoom(roomName);
      setVideoCallData({
        livekitUrl: data.livekit_url,
        token: data.token,
      });
      setIsVideoCallOpen(true);
    } catch (err) {
      console.error('Failed to join video call:', err);
    } finally {
      setIsStartingCall(false);
    }
  };

  const handleCallEnded = (duration) => {
    setIsVideoCallOpen(false);
    setVideoCallData({ livekitUrl: '', token: '' });
    // После завершения звонка обновляем сообщения, чтобы увидеть AI-саммари
    if (activeId) {
      fetchMessages(activeId);
    }
  };

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;

    currentMessages.forEach((msg) => {
      const msgDate = formatDate(msg.created_at);
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msgDate });
      }
      groups.push({ type: 'message', data: msg });
    });

    return groups;
  }, [currentMessages]);

  return (
    <div className="msg-page">
      {/* Sidebar - Conversations List */}
      <aside className={`msg-sidebar ${mobileView === 'chat' ? 'msg-sidebar-hidden' : ''}`}>
        <div className="msg-sidebar-header">
          <h1 className="msg-title">Messages</h1>
          <div className="msg-connection-status">
            <span className={`msg-status-indicator ${socketStatus === 'connected' ? 'online' : ''}`} />
          </div>
        </div>

        {/* Search */}
        <div className="msg-search-wrapper">
          <div className="msg-search-icon">
            <SearchIcon />
          </div>
          <input
            type="text"
            className="msg-search-input"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Conversations List */}
        <div className="msg-conversations">
          {loadingConvos ? (
            <div className="msg-skeleton-list">
              {[...Array(5)].map((_, idx) => (
                <div key={idx} className="msg-skeleton-item">
                  <div className="msg-skeleton-avatar" />
                  <div className="msg-skeleton-content">
                    <div className="msg-skeleton-name" />
                    <div className="msg-skeleton-text" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length ? (
            filteredConversations.map((c) => {
              const isActive = c.conversation_id === activeId;
              const other = c.other_user;
              const avatarSrc = resolveUrl(other?.photo_url) || dicebear(other?.name);
              const hasUnread = c.unread_count > 0;

              return (
                <button
                  key={c.conversation_id || other?.id}
                  className={`msg-convo-item ${isActive ? 'active' : ''} ${hasUnread ? 'unread' : ''}`}
                  onClick={() => openConversation(c)}
                >
                  <div className="msg-convo-avatar-wrapper">
                    <img
                      src={avatarSrc}
                      alt={other?.name || 'User'}
                      className="msg-convo-avatar"
                      onError={(e) => {
                        e.target.src = dicebear(other?.name);
                      }}
                    />
                    {/* Online indicator - connected to WebSocket presence */}
                    {onlineUsers.has(other?.id) && <span className="msg-online-dot" />}
                  </div>

                  <div className="msg-convo-content">
                    <div className="msg-convo-header">
                      <span className="msg-convo-name">{other?.name || 'Conversation'}</span>
                      <span className="msg-convo-time">
                        {c.last_message?.created_at && formatTime(c.last_message.created_at)}
                      </span>
                    </div>
                    <div className="msg-convo-preview">
                      <span className="msg-convo-role">
                        {other?.is_mentor ? 'Mentor' : other?.role || 'Member'}
                      </span>
                      <span className="msg-convo-separator">•</span>
                      <span className="msg-convo-last-msg">
                        {conversationPreviewText(c.last_message)}
                      </span>
                    </div>
                  </div>

                  {hasUnread && (
                    <span className="msg-unread-badge">{c.unread_count}</span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="msg-empty-conversations">
              <div className="msg-empty-icon">
                <MessageCircleIcon />
              </div>
              <h3>No conversations yet</h3>
              <p>Connect with mentors and alumni to start messaging</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className={`msg-main ${mobileView === 'list' ? 'msg-main-hidden' : ''}`}>
        {activeId && otherUser ? (
          <>
            {/* Chat Header */}
            <header className="msg-chat-header">
              <button
                className="msg-back-btn"
                onClick={() => setMobileView('list')}
              >
                <ArrowLeftIcon />
              </button>

              <div
                className="msg-chat-user"
                onClick={() => navigate(`/profile/${otherUser.id}`)}
              >
                <div className="msg-chat-avatar-wrapper">
                  <img
                    src={otherUserAvatar}
                    alt={otherUser.name}
                    className="msg-chat-avatar"
                  />
                  {isOtherUserOnline && <span className="msg-online-dot" />}
                </div>
                <div className="msg-chat-user-info">
                  <span className="msg-chat-user-name">{otherUser.name}</span>
                  <span className={`msg-chat-user-status ${isOtherUserOnline ? 'online' : 'offline'}`}>
                    {showTyping ? 'Typing...' : (isOtherUserOnline ? 'Active now' : 'Offline')}
                  </span>
                </div>
              </div>

              <div className="msg-chat-actions">
                <button className="msg-action-btn" title="Voice call">
                  <PhoneIcon />
                </button>
                <button
                  className={`msg-action-btn ${isStartingCall ? 'loading' : ''}`}
                  title="Video call"
                  onClick={startVideoCall}
                  disabled={!canMessage || isStartingCall}
                >
                  <VideoIcon />
                </button>
                <button className="msg-action-btn" title="More options">
                  <MoreIcon />
                </button>
              </div>
            </header>

            {/* Messages Area */}
            <div className="msg-messages-area">
              {loadingMessages ? (
                <div className="msg-loading-messages">
                  <div className="msg-loader" />
                  <span>Loading messages...</span>
                </div>
              ) : (
                <div className="msg-messages-list">
                  {groupedMessages.map((item, idx) => {
                    if (item.type === 'date') {
                      return (
                        <div key={`date-${idx}`} className="msg-date-divider">
                          <span>{item.date}</span>
                        </div>
                      );
                    }

                    const msg = item.data;
                    const isOwn = msg.sender_id === user?.id;
                    const isVideoInvite = msg.text?.startsWith('JOIN_VIDEO_CALL|');
                    const roomName = isVideoInvite ? msg.text.split('|')[1] : null;
                    const hasAttachment = Boolean(msg.attachment_url);
                    const imageAttachment = isImageAttachment(msg.attachment_mime_type);
                    const videoAttachment = isVideoAttachment(msg.attachment_mime_type);
                    const audioAttachment = isAudioAttachment(msg.attachment_mime_type);
                    const attachmentUrl = attachmentAccessUrl(msg);
                    const attachmentDownloadUrl = attachmentAccessUrl(msg, true);

                    return (
                      <div
                        key={msg.id || idx}
                        className={`msg-bubble-wrapper ${isOwn ? 'outgoing' : 'incoming'}`}
                      >
                        {!isOwn && (
                          <img
                            src={otherUserAvatar}
                            alt=""
                            className="msg-bubble-avatar"
                          />
                        )}
                        <div className={`msg-bubble ${isOwn ? 'outgoing' : 'incoming'}`}>
                          {isVideoInvite ? (
                            <div className="flex flex-col gap-2 items-start">
                              <span className="font-semibold">📹 Входящий видеозвонок</span>
                              <button
                                onClick={() => joinVideoCall(roomName)}
                                style={{
                                  backgroundColor: '#3b82f6',
                                  color: 'white',
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  marginTop: '8px',
                                  fontWeight: '500'
                                }}
                                disabled={isStartingCall}
                              >
                                Присоединиться
                              </button>
                            </div>
                          ) : (
                            <>
                              {hasAttachment && (
                                <div className="msg-bubble-attachment">
                                  {imageAttachment ? (
                                    <a href={attachmentUrl} target="_blank" rel="noreferrer">
                                      <img
                                        src={attachmentUrl}
                                        alt={msg.attachment_name || 'Attachment'}
                                        className="msg-attachment-image"
                                      />
                                    </a>
                                  ) : null}
                                  {videoAttachment ? (
                                    <video className="msg-attachment-video" controls preload="metadata">
                                      <source
                                        src={attachmentUrl}
                                        type={msg.attachment_mime_type || 'video/mp4'}
                                      />
                                    </video>
                                  ) : null}
                                  {audioAttachment ? (
                                    <audio className="msg-attachment-audio" controls>
                                      <source
                                        src={attachmentUrl}
                                        type={msg.attachment_mime_type || 'audio/mpeg'}
                                      />
                                    </audio>
                                  ) : null}
                                  {!imageAttachment && !videoAttachment && !audioAttachment ? (
                                    <a
                                      className="msg-file-card"
                                      href={attachmentDownloadUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      <div className="msg-file-icon">FILE</div>
                                      <div className="msg-file-details">
                                        <span className="msg-file-name">
                                          {msg.attachment_name || 'Attachment'}
                                        </span>
                                        <span className="msg-file-meta">
                                          {formatAttachmentSize(msg.attachment_size)}
                                        </span>
                                      </div>
                                    </a>
                                  ) : null}
                                </div>
                              )}
                              {msg.text?.trim() ? (
                                <p className="msg-bubble-text">{msg.text}</p>
                              ) : null}
                            </>
                          )}
                          <div className="msg-bubble-meta">
                            <span className="msg-bubble-time">{formatTime(msg.created_at)}</span>
                            {isOwn && (
                              <span className="msg-bubble-status">
                                {msg.is_read ? <CheckCheckIcon /> : <CheckIcon />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {showTyping && (
                    <div className="msg-bubble-wrapper incoming">
                      <img
                        src={otherUserAvatar}
                        alt=""
                        className="msg-bubble-avatar"
                      />
                      <div className="msg-typing-indicator">
                        <span className="msg-typing-dot" />
                        <span className="msg-typing-dot" />
                        <span className="msg-typing-dot" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Composer */}
            <footer className="msg-composer">
              {!canMessage ? (
                <div className="msg-not-friends">
                  <UserIcon />
                  <span>You need to be friends to send messages</span>
                  <button
                    className="msg-add-friend-btn"
                    onClick={() => navigate(`/profile/${otherUser.id}`)}
                  >
                    View Profile
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept={ATTACHMENT_ACCEPT}
                    onChange={handleAttachmentSelect}
                    hidden
                  />
                  {selectedAttachment ? (
                    <div className="msg-attachment-pill">
                      <div className="msg-attachment-pill-info">
                        <span className="msg-attachment-pill-name">{selectedAttachment.name}</span>
                        <span className="msg-attachment-pill-meta">
                          {formatAttachmentSize(selectedAttachment.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="msg-attachment-pill-remove"
                        onClick={clearSelectedAttachment}
                        aria-label="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                  <div className="msg-composer-main">
                    <div className="msg-composer-actions">
                      <button
                        className="msg-composer-btn"
                        title="Add attachment"
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={uploadingAttachment}
                      >
                        <PaperclipIcon />
                      </button>
                    </div>

                    <div className="msg-composer-input-wrapper">
                      <textarea
                        ref={textareaRef}
                        className="msg-composer-input"
                        placeholder="Type a message..."
                        value={draft}
                        onChange={handleTextareaChange}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        rows={1}
                      />
                      <button className="msg-emoji-btn" title="Add emoji" type="button">
                        <SmileIcon />
                      </button>
                    </div>
                    <button
                      className={`msg-send-btn ${canSendMessage ? 'active' : ''} ${uploadingAttachment ? 'loading' : ''}`}
                      onClick={handleSend}
                      disabled={!canSendMessage || uploadingAttachment}
                      type="button"
                    >
                      {uploadingAttachment ? '...' : <SendIcon />}
                    </button>
                  </div>
                </>
              )}
            </footer>
          </>
        ) : (
          <div className="msg-empty-chat">
            <div className="msg-empty-chat-icon">
              <MessageCircleIcon />
            </div>
            <h2>Select a conversation</h2>
            <p>Choose from your existing conversations or start a new one</p>
          </div>
        )}
      </main>

      {/* Right Panel - User Info */}
      {activeId && otherUser && (
        <aside className="msg-info-panel">
          <div className="msg-info-header">
            <img
              src={otherUserAvatar}
              alt={otherUser.name}
              className="msg-info-avatar"
            />
            <h3 className="msg-info-name">{otherUser.name}</h3>
            <span className="msg-info-role">
              {otherUser.is_mentor ? 'Mentor' : otherUser.role || 'Member'}
            </span>

            <div className="msg-info-actions">
              <button
                className="msg-info-btn primary"
                onClick={() => navigate(`/profile/${otherUser.id}`)}
              >
                View Profile
              </button>
              <button className="msg-info-btn secondary">
                Add Note
              </button>
            </div>
          </div>

          <div className="msg-info-section">
            <h4>Chat Info</h4>
            <div className="msg-info-item">
              <span className="msg-info-label">Status</span>
              <span className="msg-info-value">
                <span className={`msg-status-badge ${isOtherUserOnline ? 'online' : 'offline'}`}>
                  {isOtherUserOnline ? 'Active' : 'Offline'}
                </span>
              </span>
            </div>
            <div className="msg-info-item">
              <span className="msg-info-label">Last message</span>
              <span className="msg-info-value">
                {activeConversation?.last_message?.created_at
                  ? formatDate(activeConversation.last_message.created_at)
                  : '—'}
              </span>
            </div>
            <div className="msg-info-item">
              <span className="msg-info-label">Messages</span>
              <span className="msg-info-value">{currentMessages.length}</span>
            </div>
          </div>

          <div className="msg-info-section">
            <h4>Shared Media</h4>
            {sharedMediaMessages.length ? (
              <div className="msg-shared-media-list">
                {sharedMediaMessages.map((msg) => {
                  const imageAttachment = isImageAttachment(msg.attachment_mime_type);
                  const attachmentUrl = attachmentAccessUrl(msg);
                  const attachmentDownloadUrl = attachmentAccessUrl(msg, true);

                  return (
                    <a
                      key={msg.id}
                      className={imageAttachment ? 'msg-shared-media-thumb' : 'msg-shared-media-file'}
                      href={imageAttachment ? attachmentUrl : attachmentDownloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {imageAttachment ? (
                        <img
                          src={attachmentUrl}
                          alt={msg.attachment_name || 'Shared media'}
                        />
                      ) : (
                        <>
                          <span className="msg-file-name">{attachmentPreviewLabel(msg)}</span>
                          <span className="msg-file-meta">
                            {formatAttachmentSize(msg.attachment_size)}
                          </span>
                        </>
                      )}
                    </a>
                  );
                })}
              </div>
            ) : (
              <div className="msg-shared-media-empty">
                <span>No shared media yet</span>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={isVideoCallOpen}
        onClose={() => setIsVideoCallOpen(false)}
        livekitUrl={videoCallData.livekitUrl}
        token={videoCallData.token}
        otherUser={otherUser}
        onCallEnded={handleCallEnded}
      />
    </div>
  );
};

export default Messages;
