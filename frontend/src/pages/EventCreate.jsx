import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const EventCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    topic: '',
    description: '',
    type: 'networking',
    format: 'offline',
    start_time: '',
    end_time: '',
    capacity: '',
    location: '',
    online_link: '',
    company_name: '',
  });
  const [speakers, setSpeakers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [newSpeaker, setNewSpeaker] = useState({ name: '', link: '' });
  const [newMaterial, setNewMaterial] = useState({ title: '', url: '', type: 'other' });
  const canSubmit =
    formData.title.trim() &&
    formData.topic.trim() &&
    formData.start_time;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addSpeaker = () => {
    if (!newSpeaker.name.trim()) return;
    setSpeakers(prev => [...prev, { ...newSpeaker, id: Date.now() }]);
    setNewSpeaker({ name: '', link: '' });
  };

  const removeSpeaker = (id) => {
    setSpeakers(prev => prev.filter(s => s.id !== id));
  };

  const addMaterial = () => {
    if (!newMaterial.title.trim() || !newMaterial.url.trim()) return;
    setMaterials(prev => [...prev, { ...newMaterial, id: Date.now() }]);
    setNewMaterial({ title: '', url: '', type: 'other' });
  };

  const removeMaterial = (id) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.topic.trim()) throw new Error('Topic is required');
      if (!formData.start_time) throw new Error('Start time is required');

      const payload = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        speakers: speakers.map(({ name, link }) => ({ name, link: link || null })),
        materials: materials.map(({ title, url, type }) => ({ title, url, type })),
      };

      const event = await eventsApi.create(payload);
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(err.message || err.response?.data?.detail || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // Check if user can create events
  if (!user || (user.role !== 'ALUMNI' && !user.is_admin)) {
    return (
      <div className="page">
        <Alert type="error">Only alumni and administrators can create events.</Alert>
        <Button onClick={() => navigate('/events')}>Back to Events</Button>
      </div>
    );
  }

  return (
    <div className="page event-create-page">
      <div className="page-header">
        <h1>Create Event</h1>
        <p className="text-secondary">Create a new event for the alumni community</p>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <Card className="form-section elevated">
          <h2>Basic Information</h2>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="title">Event Title *</label>
              <input
                type="text"
                id="title"
                name="title"
                className="input"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter event title"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="topic">Topic *</label>
              <input
                type="text"
                id="topic"
                name="topic"
                className="input"
                value={formData.topic}
                onChange={handleChange}
                placeholder="e.g., Career Development, Machine Learning"
                required
              />
            </div>
          </div>

          <div className="form-row two-col">
            <div className="form-group">
              <label htmlFor="type">Event Type *</label>
              <select
                id="type"
                name="type"
                className="input"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="career">Career</option>
                <option value="educational">Educational</option>
                <option value="networking">Networking</option>
                <option value="recruiting">Recruiting</option>
                <option value="invite-only">Invite Only</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="format">Format *</label>
              <select
                id="format"
                name="format"
                className="input"
                value={formData.format}
                onChange={handleChange}
              >
                <option value="offline">In-Person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="input"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Describe your event..."
            />
          </div>
        </Card>

        <Card className="form-section elevated">
          <h2>Date & Time</h2>

          <div className="form-row two-col">
            <div className="form-group">
              <label htmlFor="start_time">Start Time *</label>
              <input
                type="datetime-local"
                id="start_time"
                name="start_time"
                className="input"
                value={formData.start_time}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="end_time">End Time (optional)</label>
              <input
                type="datetime-local"
                id="end_time"
                name="end_time"
                className="input"
                value={formData.end_time}
                onChange={handleChange}
              />
            </div>
          </div>
        </Card>

        <Card className="form-section elevated">
          <h2>Location & Capacity</h2>

          <div className="form-row two-col">
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                className="input"
                value={formData.location}
                onChange={handleChange}
                placeholder="Physical address"
              />
            </div>
            <div className="form-group">
              <label htmlFor="capacity">Capacity (optional)</label>
              <input
                type="number"
                id="capacity"
                name="capacity"
                className="input"
                value={formData.capacity}
                onChange={handleChange}
                min="1"
                placeholder="Max attendees"
              />
            </div>
          </div>

          {(formData.format === 'online' || formData.format === 'hybrid') && (
            <div className="form-group">
              <label htmlFor="online_link">Online Join Link</label>
              <input
                type="url"
                id="online_link"
                name="online_link"
                className="input"
                value={formData.online_link}
                onChange={handleChange}
                placeholder="https://zoom.us/j/..."
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="company_name">Company (optional)</label>
            <input
              type="text"
              id="company_name"
              name="company_name"
              className="input"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Sponsoring or hosting company"
            />
          </div>
        </Card>

        <Card className="form-section elevated">
          <h2>Speakers</h2>

          <div className="add-item-row">
            <input
              type="text"
              className="input"
              placeholder="Speaker name"
              value={newSpeaker.name}
              onChange={(e) => setNewSpeaker(prev => ({ ...prev, name: e.target.value }))}
            />
            <input
              type="url"
              className="input"
              placeholder="Profile link (optional)"
              value={newSpeaker.link}
              onChange={(e) => setNewSpeaker(prev => ({ ...prev, link: e.target.value }))}
            />
            <Button type="button" className="btn-secondary" onClick={addSpeaker}>
              Add
            </Button>
          </div>

          {speakers.length > 0 && (
            <div className="items-list">
              {speakers.map((speaker) => (
                <div key={speaker.id} className="item-tag">
                  <span>{speaker.name}</span>
                  <button type="button" onClick={() => removeSpeaker(speaker.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="form-section elevated">
          <h2>Materials</h2>

          <div className="add-item-row">
            <input
              type="text"
              className="input"
              placeholder="Material title"
              value={newMaterial.title}
              onChange={(e) => setNewMaterial(prev => ({ ...prev, title: e.target.value }))}
            />
            <input
              type="url"
              className="input"
              placeholder="URL"
              value={newMaterial.url}
              onChange={(e) => setNewMaterial(prev => ({ ...prev, url: e.target.value }))}
            />
            <select
              className="input"
              value={newMaterial.type}
              onChange={(e) => setNewMaterial(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="agenda">Agenda</option>
              <option value="presentation">Presentation</option>
              <option value="document">Document</option>
              <option value="other">Other</option>
            </select>
            <Button type="button" className="btn-secondary" onClick={addMaterial}>
              Add
            </Button>
          </div>

          {materials.length > 0 && (
            <div className="items-list">
              {materials.map((material) => (
                <div key={material.id} className="item-tag">
                  <span>{material.title} ({material.type})</span>
                  <button type="button" onClick={() => removeMaterial(material.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="form-actions">
          <Button
            type="button"
            className="btn-secondary event-create-cancel"
            onClick={() => navigate('/events')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="btn-primary event-create-submit"
            disabled={loading || !canSubmit}
          >
            {loading ? 'Creating...' : 'Create Event'}
          </Button>
        </div>

        {!canSubmit && (
          <p className="form-hint">
            Fill in `Event Title`, `Topic`, and `Start Time` to enable event creation.
          </p>
        )}

        <p className="form-note">
          Your event will be published right after creation and become visible to all roles.
        </p>
      </form>

      <style>{`
        .event-create-page {
          max-width: 800px;
          margin: 0 auto;
        }
        
        .form-section {
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .form-section h2 {
          margin: 0 0 1.25rem;
          font-size: 1.1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--border-color);
        }
        
        .form-row {
          margin-bottom: 1rem;
        }
        
        .form-row.two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        
        @media (max-width: 600px) {
          .form-row.two-col { grid-template-columns: 1fr; }
        }
        
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .form-group label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        
        .input {
          padding: 0.75rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.9rem;
        }
        
        .input:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px var(--accent-primary-alpha);
        }
        
        textarea.input {
          resize: vertical;
          min-height: 100px;
        }
        
        .add-item-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        
        .add-item-row .input {
          flex: 1;
          min-width: 150px;
        }
        
        .items-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        
        .item-tag {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--bg-secondary);
          border-radius: 6px;
          font-size: 0.875rem;
        }
        
        .item-tag button {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: var(--text-tertiary);
          padding: 0;
          line-height: 1;
        }
        
        .item-tag button:hover {
          color: var(--text-primary);
        }
        
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 1.5rem;
          position: sticky;
          bottom: 0;
          padding-top: 1rem;
          padding-bottom: 1rem;
          background: linear-gradient(180deg, rgba(248, 250, 252, 0) 0%, var(--bg-page) 28%, var(--bg-page) 100%);
          z-index: 2;
        }

        .form-hint {
          margin: 0.75rem 0 0;
          text-align: right;
          font-size: 0.84rem;
          color: var(--text-secondary);
        }
        
        .form-note {
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-tertiary);
          margin-top: 1rem;
        }
        
        .event-create-submit {
          min-width: 176px;
          background: #111827;
          color: #f9fafb;
          border: 1px solid #0f172a;
          padding: 0.8rem 1.5rem;
          font-weight: 600;
        }
        
        .event-create-submit:hover:not(:disabled) {
          background: #0f172a;
          border-color: #0b1220;
        }

        .event-create-submit:disabled {
          background: #e5e7eb;
          color: #6b7280;
          border-color: #d1d5db;
          cursor: not-allowed;
          opacity: 1;
          box-shadow: none;
          transform: none;
        }
        
        .event-create-cancel {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          padding: 0.8rem 1.5rem;
          font-weight: 600;
        }

        .event-create-cancel:hover {
          background: var(--bg-elevated);
        }
      `}</style>
    </div>
  );
};

export default EventCreate;
