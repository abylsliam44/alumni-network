import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from './api/axios';
import { PROJECT_CATEGORIES } from './api/projects';
import Icon from './components/ui/Icon';

export default function IntegratedProjectPreferences() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/api/v1/project-preferences').then(({ data: result }) => setData(result))
      .catch(() => setError('Не удалось загрузить настройки рекомендаций.'));
  }, []);
  async function save(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(''); setNotice('');
    try {
      const { data: result } = await api.put('/api/v1/project-preferences', {
        career_interests: form.get('interests').split(',').map((value) => value.trim()).filter(Boolean),
        preferred_project_categories: form.getAll('categories'),
      });
      setData(result); setNotice('Настройки сохранены. Подборка проектов обновится при следующем открытии.');
    } catch {
      setError('Не удалось сохранить настройки. Проверьте данные и повторите попытку.');
    } finally { setBusy(false); }
  }
  return <div className="academic-app integrated-academic"><div className="academic-stage"><main className="academic-content">
    <div className="simple-heading"><p className="eyebrow"><span className="eyebrow-line" /> PROJECT MATCHES</p><h1>Настройте <em>свою подборку.</em></h1><p>Категории и интересы помогают находить проекты, близкие вам по теме.</p></div>
    <section className="panel profile-editor"><div className="section-heading">НАСТРОЙКИ РЕКОМЕНДАЦИЙ <Icon name="spark" size={15} /></div>
      {error && <p className="academic-error" role="alert">{error}</p>}
      {data && <form className="stack" onSubmit={save}><div><span>Навыки из вашего профиля:</span><div className="skill-list">{data.skills?.length ? data.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>Не указаны</span>}</div><p className="field-note">Изменить навыки можно в <Link to="/profile/edit">основном профиле</Link>.</p></div>
        <label>Интересы через запятую<input name="interests" placeholder="education, research" defaultValue={data.career_interests?.join(', ') || ''} /><small className="field-note">Сравниваются с тегами проектов по точному совпадению.</small></label>
        <fieldset className="category-fieldset"><legend>Предпочитаемые категории</legend><div className="category-options">{Object.entries(PROJECT_CATEGORIES).map(([key, value]) => <label key={key}><input name="categories" type="checkbox" value={key} defaultChecked={data.preferred_project_categories?.includes(key)} /><span>{value}</span></label>)}</div></fieldset>
        {notice && <p className="academic-notice" role="status">{notice}</p>}<button disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить настройки'} <Icon name="arrowR" size={14} /></button>
      </form>}
    </section></main></div></div>;
}
