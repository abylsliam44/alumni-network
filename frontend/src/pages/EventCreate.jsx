import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/events';
import { useAuth } from '../hooks/useAuth';
import Alert from '../components/ui/Alert';
import Icon from '../components/ui/Icon';

const EventCreate = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    title: '', topic: '', description: '',
    type: 'networking', format: 'offline',
    start_time: '', end_time: '',
    capacity: '', location: '', online_link: '', company_name: '',
  });
  const [speakers, setSpeakers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [newSpeaker, setNewSpeaker] = useState({ name: '', link: '' });
  const [newMaterial, setNewMaterial] = useState({ title: '', url: '', type: 'other' });

  const handleChange = (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const addSpeaker = () => {
    if (!newSpeaker.name.trim()) return;
    setSpeakers((p) => [...p, { ...newSpeaker, id: Date.now() }]);
    setNewSpeaker({ name: '', link: '' });
  };
  const removeSpeaker = (id) => setSpeakers((p) => p.filter((s) => s.id !== id));

  const addMaterial = () => {
    if (!newMaterial.title.trim() || !newMaterial.url.trim()) return;
    setMaterials((p) => [...p, { ...newMaterial, id: Date.now() }]);
    setNewMaterial({ title: '', url: '', type: 'other' });
  };
  const removeMaterial = (id) => setMaterials((p) => p.filter((m) => m.id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      if (!formData.title.trim()) throw new Error('Title is required');
      if (!formData.topic.trim()) throw new Error('Topic is required');
      if (!formData.start_time) throw new Error('Start time is required');
      const payload = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity, 10) : null,
        speakers: speakers.map(({ name, link }) => ({ name, link: link || null })),
        materials: materials.map(({ title, url, type }) => ({ title, url, type })),
      };
      const event = await eventsApi.create(payload);
      navigate(`/events/${event.id}`);
    } catch (err) {
      setError(err.message || err.response?.data?.detail || 'Failed to create event');
    } finally { setLoading(false); }
  };

  if (!user || (user.role !== 'ALUMNI' && !user.is_admin)) {
    return (
      <div className="page">
        <div className="empty-block">
          <Icon name="alert" size={28} />
          <h3>Restricted</h3>
          <p>Only alumni and administrators can create events.</p>
          <button className="btn" onClick={() => navigate('/events')}>Back to events</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>EVENTS · NEW</div>
          <h1 className="h1">Create an <i>event</i>.</h1>
        </div>
        <div className="page-head-actions">
          <button className="btn ghost" onClick={() => navigate('/events')}>Cancel</button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="form-stack">
        <div className="form-card">
          <div className="form-card-head"><h3>Basic information</h3></div>
          <div className="form-group">
            <label>Event title *</label>
            <input name="title" value={formData.title} onChange={handleChange} required placeholder="e.g. AITU × Kaspi Tech Talk" />
          </div>
          <div className="form-group">
            <label>Topic *</label>
            <input name="topic" value={formData.topic} onChange={handleChange} required placeholder="e.g. Career strategy" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={formData.description} onChange={handleChange} rows="5" placeholder="What's the event about?" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="networking">Networking</option>
                <option value="career">Career</option>
                <option value="educational">Educational</option>
                <option value="recruiting">Recruiting</option>
                <option value="invite-only">Invite-only</option>
              </select>
            </div>
            <div className="form-group">
              <label>Format</label>
              <select name="format" value={formData.format} onChange={handleChange}>
                <option value="offline">In person</option>
                <option value="online">Online</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-card">
          <div className="form-card-head"><h3>When & where</h3></div>
          <div className="form-row">
            <div className="form-group"><label>Start time *</label><input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleChange} required /></div>
            <div className="form-group"><label>End time</label><input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleChange} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Capacity</label><input type="number" min="1" name="capacity" value={formData.capacity} onChange={handleChange} placeholder="e.g. 80" /></div>
            <div className="form-group"><label>Company / Org</label><input type="text" name="company_name" value={formData.company_name} onChange={handleChange} placeholder="Optional" /></div>
          </div>
          {(formData.format === 'offline' || formData.format === 'hybrid') && (
            <div className="form-group">
              <label>Location</label>
              <input type="text" name="location" value={formData.location} onChange={handleChange} placeholder="Address or venue" />
            </div>
          )}
          {(formData.format === 'online' || formData.format === 'hybrid') && (
            <div className="form-group">
              <label>Online link</label>
              <input type="url" name="online_link" value={formData.online_link} onChange={handleChange} placeholder="https://meet.example.com/…" />
            </div>
          )}
        </div>

        <div className="form-card">
          <div className="form-card-head"><h3>Speakers</h3><p>Add people who will speak at this event.</p></div>
          {speakers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {speakers.map((s) => (
                <div key={s.id} className="panel" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{s.name}</strong>
                    {s.link && <div className="mute mono" style={{ fontSize: 10.5 }}>{s.link}</div>}
                  </div>
                  <button type="button" className="btn sm ghost" onClick={() => removeSpeaker(s.id)}><Icon name="trash" size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}><label>Name</label><input type="text" value={newSpeaker.name} onChange={(e) => setNewSpeaker((p) => ({ ...p, name: e.target.value }))} placeholder="Speaker name" /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>Link</label><input type="url" value={newSpeaker.link} onChange={(e) => setNewSpeaker((p) => ({ ...p, link: e.target.value }))} placeholder="LinkedIn URL (optional)" /></div>
          </div>
          <button type="button" className="btn sm" onClick={addSpeaker} style={{ marginTop: 10 }}><Icon name="plus" size={12} /> Add speaker</button>
        </div>

        <div className="form-card">
          <div className="form-card-head"><h3>Materials</h3><p>Slides, agenda, links — anything attendees should access.</p></div>
          {materials.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {materials.map((m) => (
                <div key={m.id} className="panel" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: 13 }}>{m.title}</strong>
                    <div className="mute mono" style={{ fontSize: 10.5 }}>{m.url}</div>
                  </div>
                  <span className="chip">{m.type}</span>
                  <button type="button" className="btn sm ghost" onClick={() => removeMaterial(m.id)}><Icon name="trash" size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="form-row">
            <div className="form-group" style={{ marginBottom: 0 }}><label>Title</label><input type="text" value={newMaterial.title} onChange={(e) => setNewMaterial((p) => ({ ...p, title: e.target.value }))} placeholder="Slides" /></div>
            <div className="form-group" style={{ marginBottom: 0 }}><label>URL</label><input type="url" value={newMaterial.url} onChange={(e) => setNewMaterial((p) => ({ ...p, url: e.target.value }))} placeholder="https://…" /></div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Type</label>
              <select value={newMaterial.type} onChange={(e) => setNewMaterial((p) => ({ ...p, type: e.target.value }))}>
                <option value="agenda">Agenda</option>
                <option value="presentation">Presentation</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <button type="button" className="btn sm" onClick={addMaterial} style={{ marginTop: 10 }}><Icon name="plus" size={12} /> Add material</button>
        </div>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/events')}>Cancel</button>
          <button type="submit" className="btn primary" disabled={loading}>{loading ? 'Creating…' : 'Create event'}</button>
        </div>
      </form>
    </div>
  );
};

export default EventCreate;
