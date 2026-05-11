import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import Icon from './ui/Icon';

const NotificationDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch unread count', err);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationsApi.list(20);
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen(!isOpen);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await notificationsApi.markAsRead([notificationId]);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const getNotificationLink = (notification) => {
    switch (notification.type) {
      case 'FRIEND_REQUEST':
        return '/friends?tab=requests';
      case 'FRIEND_ACCEPTED':
        return '/friends';
      case 'MENTORSHIP_REQUEST':
        return '/dashboard';
      case 'MENTORSHIP_ACCEPTED':
        return '/directory';
      case 'NEW_MESSAGE':
        return notification.reference_id ? `/messages?chat=${notification.reference_id}` : '/messages';
      case 'EVENT_APPROVED':
        return notification.reference_id ? `/events/${notification.reference_id}` : '/opportunities';
      case 'EVENT_CANCELLED':
      case 'EVENT_REGISTRATION':
      case 'EVENT_WAITLIST':
      case 'EVENT_WAITLIST_PROMOTED':
      case 'EVENT_REMINDER':
        return notification.reference_id ? `/events/${notification.reference_id}` : '/events';
      default:
        return '#';
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notif-dropdown" ref={dropdownRef}>
      <button 
        className={`notif-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={handleToggle}
        aria-label="Notifications"
        title="Notifications"
      >
        <Icon name="bell" />
        <span className="notif-trigger-text">Notifications</span>
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-panel">
          <div className="notif-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {loading ? (
              <div className="notif-loading">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  to={getNotificationLink(notification)}
                  className={`notif-item ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => {
                    if (!notification.is_read) {
                      handleMarkAsRead(notification.id);
                    }
                    setIsOpen(false);
                  }}
                >
                  <div className="notif-item-content">
                    <p className="notif-item-title">{notification.title}</p>
                    <p className="notif-item-message">{notification.message}</p>
                    <span className="notif-item-time">{formatTime(notification.created_at)}</span>
                  </div>
                  {!notification.is_read && <span className="notif-item-dot"></span>}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
