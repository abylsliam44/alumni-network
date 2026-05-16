import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { profileApi } from '../api/profile';
import Avatar from '../components/ui/Avatar';
import Pill from '../components/ui/Pill';
import Icon from '../components/ui/Icon';
import Alert from '../components/ui/Alert';
import { resolveUrl } from '../utils/image';

const emptyEdu = { school: '', degree: '', field_of_study: '', start_date: '', end_date: '', grade: '', current: false };
const emptyExp = { company: '', position: '', location: '', start_date: '', end_date: '', description: '', current: false };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EditProfile = () => {
  const navigate = useNavigate();
  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [formData, setFormData] = useState({
    name: '', headline: '', bio: '', location: '',
    linkedin_url: '', github_url: '', website_url: '',
    graduation_year: '', availability: '', skills: '',
    education: [], experience: [],
    photo_url: null, cover_url: null,
    is_mentor: false,
    mentor_consent: false, mentor_headline: '',
    mentor_areas_of_help: [], mentor_industries: [],
    mentor_max_mentees: '', mentor_availability_note: '',
    mentor_availability_slots: [],
  });
  const [showEduModal, setShowEduModal] = useState(false);
  const [showExpModal, setShowExpModal] = useState(false);
  const [currentEdu, setCurrentEdu] = useState(emptyEdu);
  const [currentExp, setCurrentExp] = useState(emptyExp);
  const [editIndex, setEditIndex] = useState(-1);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const data = await profileApi.getMe();
      setFormData({
        ...data,
        is_mentor: data.is_mentor || false,
        skills: data.skills ? data.skills.join(', ') : '',
        mentor_areas_of_help: data.mentor_areas_of_help || [],
        mentor_industries: data.mentor_industries || [],
        mentor_availability_slots: data.mentor_availability_slots || [],
        education: data.education || [],
        experience: data.experience || [],
        graduation_year: data.graduation_year || '',
        mentor_max_mentees: data.mentor_max_mentees || '',
        github_url: data.github_url || '',
        website_url: data.website_url || '',
        headline: data.headline || '',
        availability: data.availability || '',
        linkedin_url: data.linkedin_url || '',
      });
    } catch (err) { console.error('Failed to load profile', err); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((p) => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSlotChange = (index, field, value) => {
    setFormData((p) => ({
      ...p,
      mentor_availability_slots: p.mentor_availability_slots.map((slot, i) => (
        i === index ? { ...slot, [field]: field === 'weekday' ? Number(value) : value } : slot
      )),
    }));
  };

  const addSlot = () => {
    setFormData((p) => ({
      ...p,
      mentor_availability_slots: [
        ...p.mentor_availability_slots,
        { id: `slot-${Date.now()}`, weekday: 0, start_time: '18:00', end_time: '19:00' },
      ],
    }));
  };

  const removeSlot = (index) => {
    setFormData((p) => ({
      ...p,
      mentor_availability_slots: p.mentor_availability_slots.filter((_, i) => i !== index),
    }));
  };

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const res = type === 'avatar' ? await profileApi.uploadPhoto(file) : await profileApi.uploadCover(file);
      setFormData((p) => ({ ...p, ...(type === 'avatar' ? { photo_url: res.photo_url } : { cover_url: res.cover_url }) }));
      setNotice({ type: 'success', message: `${type === 'avatar' ? 'Avatar' : 'Cover'} updated` });
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: `Failed to upload ${type}` });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setNotice(null);
    try {
      const payload = {
        ...formData,
        skills: typeof formData.skills === 'string'
          ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean)
          : formData.skills,
        graduation_year: formData.graduation_year ? parseInt(formData.graduation_year, 10) : null,
        mentor_max_mentees: formData.mentor_max_mentees ? parseInt(formData.mentor_max_mentees, 10) : null,
      };
      await profileApi.updateMe(payload);
      navigate('/profile');
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', message: 'Failed to update profile' });
    } finally { setSaving(false); }
  };

  const openEduModal = (edu = null, idx = -1) => { setCurrentEdu(edu || emptyEdu); setEditIndex(idx); setShowEduModal(true); };
  const saveEducation = () => {
    const list = [...formData.education];
    if (editIndex >= 0) list[editIndex] = currentEdu; else list.push(currentEdu);
    setFormData({ ...formData, education: list });
    setShowEduModal(false);
  };
  const removeEducation = (i) => setFormData({ ...formData, education: formData.education.filter((_, idx) => idx !== i) });

  const openExpModal = (exp = null, idx = -1) => { setCurrentExp(exp || emptyExp); setEditIndex(idx); setShowExpModal(true); };
  const saveExperience = () => {
    const list = [...formData.experience];
    if (editIndex >= 0) list[editIndex] = currentExp; else list.push(currentExp);
    setFormData({ ...formData, experience: list });
    setShowExpModal(false);
  };
  const removeExperience = (i) => setFormData({ ...formData, experience: formData.experience.filter((_, idx) => idx !== i) });

  const completion = (() => {
    const checks = [
      ['Name', !!formData.name?.trim()],
      ['Headline', !!formData.headline?.trim()],
      ['Bio', !!formData.bio?.trim()],
      ['Location', !!formData.location?.trim()],
      ['Skills', !!(typeof formData.skills === 'string' ? formData.skills.trim() : formData.skills?.length)],
      ['Experience', formData.experience.length > 0],
      ['Education', formData.education.length > 0],
      ['Photo', !!formData.photo_url],
      ['Graduation year', !!formData.graduation_year],
    ];
    const done = checks.filter(([, ok]) => ok).length;
    const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
    return { percent: Math.round((done / checks.length) * 100), missing };
  })();

  if (loading) return <div className="page"><div className="loading-block">Loading…</div></div>;

  return (
    <div className="page form-page">
      <div className="page-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>EDIT · IDENTITY</div>
          <h1 className="h1">Polish your <i>profile</i>.</h1>
        </div>
        <div className="page-head-actions">
          <button className="btn" onClick={() => navigate('/profile/resume-import')}>
            <Icon name="upload" size={14} /> Import resume
          </button>
          <button className="btn ghost" onClick={() => navigate('/profile')}>Cancel</button>
          <button className="btn primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>

      {notice && <Alert type={notice.type === 'success' ? 'success' : 'error'}>{notice.message}</Alert>}

      <div className="panel" style={{ padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="eyebrow">PROFILE COMPLETION</div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--blue)' }}>{completion.percent}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${completion.percent}%`, height: '100%', background: completion.percent === 100 ? 'var(--ok)' : 'var(--blue)', transition: 'width 0.3s' }} />
        </div>
        {completion.missing.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="mute mono" style={{ fontSize: 10 }}>ADD TO IMPROVE:</span>
            {completion.missing.slice(0, 4).map((m) => (<span key={m} className="chip skill">{m}</span>))}
            {completion.missing.length > 4 && <span className="chip skill">+{completion.missing.length - 4}</span>}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        {/* Photos */}
        <div className="form-card">
          <div className="form-card-head">
            <h3>Profile images</h3>
            <p>JPG/PNG, up to 5MB.</p>
          </div>

          <div className="edit-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'flex-start' }}>
            <div>
              <div style={{ position: 'relative' }}>
                <Avatar src={resolveUrl(formData.photo_url)} name={formData.name} size="xxl" />
                <button
                  type="button"
                  className="btn sm"
                  style={{ position: 'absolute', right: -6, bottom: -6 }}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Icon name="edit" size={12} /> Change
                </button>
              </div>
              <input type="file" accept="image/*" ref={avatarInputRef} style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e, 'avatar')} />
            </div>

            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>COVER IMAGE</div>
              <div
                style={{
                  height: 120, borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: formData.cover_url
                    ? `url(${resolveUrl(formData.cover_url)}) center / cover`
                    : 'repeating-linear-gradient(-45deg, rgba(216,165,116,0.08) 0 8px, transparent 8px 16px), var(--bg-2)',
                  position: 'relative',
                }}
              >
                <button
                  type="button"
                  className="btn sm"
                  style={{ position: 'absolute', right: 10, bottom: 10 }}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <Icon name="edit" size={12} /> Change cover
                </button>
              </div>
              <input type="file" accept="image/*" ref={coverInputRef} style={{ display: 'none' }} onChange={(e) => handlePhotoUpload(e, 'cover')} />
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div className="form-card">
          <div className="form-card-head"><h3>Basic info</h3></div>
          <div className="form-row">
            <div className="form-group"><label>Name</label><input name="name" value={formData.name} onChange={handleChange} required /></div>
            <div className="form-group"><label>Graduation year</label><input name="graduation_year" type="number" value={formData.graduation_year} onChange={handleChange} placeholder="2025" /></div>
          </div>
          <div className="form-group"><label>Headline</label><input name="headline" value={formData.headline} onChange={handleChange} placeholder="e.g. Y3 SE student · backend & ML interest" /></div>
          <div className="form-group"><label>Bio</label><textarea name="bio" value={formData.bio} onChange={handleChange} rows="4" placeholder="Tell others about yourself…" /></div>
          <div className="form-row">
            <div className="form-group"><label>Location</label><input name="location" value={formData.location} onChange={handleChange} placeholder="Almaty, KZ" /></div>
            <div className="form-group"><label>Skills (comma-separated)</label><input name="skills" value={formData.skills} onChange={handleChange} placeholder="Python, Go, PyTorch…" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>LinkedIn URL</label><input name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/…" /></div>
            <div className="form-group"><label>GitHub URL</label><input name="github_url" value={formData.github_url} onChange={handleChange} placeholder="https://github.com/…" /></div>
          </div>
          <div className="form-group"><label>Website URL</label><input name="website_url" value={formData.website_url} onChange={handleChange} placeholder="https://…" /></div>
        </div>

        {/* Experience */}
        <div className="form-card">
          <div className="form-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><h3>Experience</h3><p>{formData.experience.length} entries.</p></div>
            <button type="button" className="btn sm" onClick={() => openExpModal()}><Icon name="plus" size={12} /> Add</button>
          </div>
          {formData.experience.length === 0 ? (
            <div className="empty-block"><h3>No experience added</h3></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {formData.experience.map((exp, i) => (
                <div key={i} className="panel edit-list-row" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div className="h3">{exp.position}</div>
                    <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {(exp.company || '').toUpperCase()} · {exp.start_date || '?'} — {exp.current ? 'NOW' : (exp.end_date || '?')}
                    </div>
                  </div>
                  <div className="mobile-row-actions" style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn sm ghost" onClick={() => openExpModal(exp, i)}>Edit</button>
                    <button type="button" className="btn sm ghost" onClick={() => removeExperience(i)}><Icon name="trash" size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Education */}
        <div className="form-card">
          <div className="form-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><h3>Education</h3><p>{formData.education.length} entries.</p></div>
            <button type="button" className="btn sm" onClick={() => openEduModal()}><Icon name="plus" size={12} /> Add</button>
          </div>
          {formData.education.length === 0 ? (
            <div className="empty-block"><h3>No education added</h3></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {formData.education.map((edu, i) => (
                <div key={i} className="panel edit-list-row" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
                  <div>
                    <div className="h3">{edu.school}</div>
                    <div className="mute mono" style={{ fontSize: 10.5, marginTop: 2 }}>
                      {(edu.degree || '').toUpperCase()}{edu.field_of_study ? ` · ${edu.field_of_study.toUpperCase()}` : ''} · {edu.start_date || '?'} — {edu.end_date || 'NOW'}
                    </div>
                  </div>
                  <div className="mobile-row-actions" style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn sm ghost" onClick={() => openEduModal(edu, i)}>Edit</button>
                    <button type="button" className="btn sm ghost" onClick={() => removeEducation(i)}><Icon name="trash" size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mentor settings */}
        <div className="form-card">
          <div className="form-card-head"><h3>Mentor settings</h3><p>Manage your active mentor profile.</p></div>
          {!formData.is_mentor ? (
            <div className="panel" style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="h3">Not active as a mentor yet</div>
                <div className="mute" style={{ fontSize: 12, marginTop: 4 }}>Activate a mentor profile first, then edit availability and capacity here.</div>
              </div>
              <Link to="/become-mentor" className="btn sm primary">Become a mentor</Link>
            </div>
          ) : (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 13, marginBottom: 14 }}>
                <input type="checkbox" name="mentor_consent" checked={!!formData.mentor_consent} onChange={handleChange} />
                <span>I am available to receive mentorship requests</span>
              </label>
              <div className="form-group" style={{ marginTop: 14 }}>
                <label>Mentor headline</label>
                <input name="mentor_headline" value={formData.mentor_headline} onChange={handleChange} placeholder="What you help with as a mentor" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Areas of help</label>
                  <input
                    value={(formData.mentor_areas_of_help || []).join(', ')}
                    onChange={(e) => setFormData((p) => ({ ...p, mentor_areas_of_help: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                    placeholder="DSA, resume review, roadmap"
                  />
                </div>
                <div className="form-group">
                  <label>Industries</label>
                  <input
                    value={(formData.mentor_industries || []).join(', ')}
                    onChange={(e) => setFormData((p) => ({ ...p, mentor_industries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))}
                    placeholder="AI, fintech, olympiads"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Max mentees</label>
                  <input type="number" min="1" max="20" name="mentor_max_mentees" value={formData.mentor_max_mentees} onChange={handleChange} placeholder="5" />
                </div>
                <div className="form-group">
                  <label>Availability note</label>
                  <input name="mentor_availability_note" value={formData.mentor_availability_note} onChange={handleChange} placeholder="e.g. 30min/week, evenings" />
                </div>
              </div>
              <div className="form-group">
                <label>Availability slots</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(formData.mentor_availability_slots || []).map((slot, index) => (
                    <div key={slot.id || index} className="availability-slot-row">
                      <select value={slot.weekday} onChange={(e) => handleSlotChange(index, 'weekday', e.target.value)}>
                        {WEEKDAYS.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                      </select>
                      <input type="time" value={slot.start_time} onChange={(e) => handleSlotChange(index, 'start_time', e.target.value)} />
                      <input type="time" value={slot.end_time} onChange={(e) => handleSlotChange(index, 'end_time', e.target.value)} />
                      <button type="button" className="btn sm ghost" onClick={() => removeSlot(index)}>
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn sm" onClick={addSlot} style={{ alignSelf: 'flex-start' }}>
                    <Icon name="plus" size={12} /> Add slot
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn ghost" onClick={() => navigate('/profile')}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving...' : 'Save profile'}</button>
        </div>
      </form>

      {/* Education modal */}
      {showEduModal && (
        <div className="modal-backdrop" onClick={() => setShowEduModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>{editIndex >= 0 ? 'Edit education' : 'Add education'}</h3>
              <button className="iconbtn" onClick={() => setShowEduModal(false)}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label>School</label><input value={currentEdu.school} onChange={(e) => setCurrentEdu({ ...currentEdu, school: e.target.value })} /></div>
              <div className="form-row">
                <div className="form-group"><label>Degree</label><input value={currentEdu.degree} onChange={(e) => setCurrentEdu({ ...currentEdu, degree: e.target.value })} /></div>
                <div className="form-group"><label>Field of study</label><input value={currentEdu.field_of_study} onChange={(e) => setCurrentEdu({ ...currentEdu, field_of_study: e.target.value })} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start date</label><input type="date" value={currentEdu.start_date || ''} onChange={(e) => setCurrentEdu({ ...currentEdu, start_date: e.target.value })} /></div>
                <div className="form-group"><label>End date</label><input type="date" value={currentEdu.end_date || ''} onChange={(e) => setCurrentEdu({ ...currentEdu, end_date: e.target.value })} disabled={currentEdu.current} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>
                <input type="checkbox" checked={!!currentEdu.current} onChange={(e) => setCurrentEdu({ ...currentEdu, current: e.target.checked })} /> I am currently studying here
              </label>
              <div className="form-group" style={{ marginTop: 12 }}><label>Grade / GPA</label><input value={currentEdu.grade || ''} onChange={(e) => setCurrentEdu({ ...currentEdu, grade: e.target.value })} /></div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowEduModal(false)}>Cancel</button>
              <button className="btn primary" onClick={saveEducation}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Experience modal */}
      {showExpModal && (
        <div className="modal-backdrop" onClick={() => setShowExpModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>{editIndex >= 0 ? 'Edit experience' : 'Add experience'}</h3>
              <button className="iconbtn" onClick={() => setShowExpModal(false)}><Icon name="close" size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Position</label><input value={currentExp.position} onChange={(e) => setCurrentExp({ ...currentExp, position: e.target.value })} /></div>
                <div className="form-group"><label>Company</label><input value={currentExp.company} onChange={(e) => setCurrentExp({ ...currentExp, company: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Location</label><input value={currentExp.location} onChange={(e) => setCurrentExp({ ...currentExp, location: e.target.value })} /></div>
              <div className="form-row">
                <div className="form-group"><label>Start date</label><input type="date" value={currentExp.start_date || ''} onChange={(e) => setCurrentExp({ ...currentExp, start_date: e.target.value })} /></div>
                <div className="form-group"><label>End date</label><input type="date" value={currentExp.end_date || ''} onChange={(e) => setCurrentExp({ ...currentExp, end_date: e.target.value })} disabled={currentExp.current} /></div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--sans)', textTransform: 'none', letterSpacing: 0, fontSize: 13 }}>
                <input type="checkbox" checked={!!currentExp.current} onChange={(e) => setCurrentExp({ ...currentExp, current: e.target.checked })} /> I currently work here
              </label>
              <div className="form-group" style={{ marginTop: 12 }}><label>Description</label><textarea value={currentExp.description || ''} rows="3" onChange={(e) => setCurrentExp({ ...currentExp, description: e.target.value })} /></div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowExpModal(false)}>Cancel</button>
              <button className="btn primary" onClick={saveExperience}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;
