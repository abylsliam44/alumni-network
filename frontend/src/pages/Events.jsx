import { useEffect, useState } from 'react';
import { eventsApi } from '../api/events';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await eventsApi.list({ limit: 20 });
      setEvents(data.items);
    } finally {
      setLoading(false);
    }
  };

  const register = async (id) => {
    try {
      await eventsApi.register(id);
      setNotice({ type: 'success', message: 'Registered!' });
    } catch (e) {
      setNotice({ type: 'error', message: e.response?.data?.detail || 'Failed to register' });
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Events</h1>
        <p>Join upcoming meetups and workshops.</p>
      </div>
      {notice && <Alert type={notice.type}>{notice.message}</Alert>}
      {loading ? (
        <div className="loading-spinner">Loading events...</div>
      ) : (
        <div className="grid-vertical">
          {events.map((event) => (
            <Card key={event.id}>
              <div className="card-top">
                <div>
                  <p className="eyebrow">{new Date(event.date_time).toLocaleString()}</p>
                  <h3>{event.title}</h3>
                  <p className="text-secondary">{event.location || 'Online'}</p>
                </div>
                <Button variant="primary" onClick={() => register(event.id)}>Register</Button>
              </div>
              <div className="card-meta">
                <span>{event.registrations_count} registered</span>
                {event.max_attendees && <span>Capacity {event.max_attendees}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Events;

