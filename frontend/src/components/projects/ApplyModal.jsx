import { useMemo, useState } from 'react';
import Icon from '../ui/Icon';

const ApplyModal = ({ project, profile, onClose, onSubmit }) => {
  const initialSkills = useMemo(() => (profile?.skills || []).join(', '), [profile?.skills]);
  const [message, setMessage] = useState('');
  const [skills, setSkills] = useState(initialSkills);
  const [fitReason, setFitReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        message,
        skills: skills.split(',').map((item) => item.trim()).filter(Boolean),
        fit_reason: fitReason,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">JOIN PROJECT</div>
            <h3>{project.title}</h3>
          </div>
          <button className="iconbtn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Message</label>
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Introduce yourself and what you want to build..." required />
            </div>
            <div className="form-group">
              <label>Your skills</label>
              <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Node.js, UI/UX" />
            </div>
            <div className="form-group">
              <label>Why you are a fit</label>
              <textarea rows={4} value={fitReason} onChange={(e) => setFitReason(e.target.value)} placeholder="Relevant projects, domain interest, availability..." />
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={submitting}>{submitting ? 'Submitting...' : 'Send application'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyModal;
