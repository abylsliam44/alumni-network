const PageHead = ({ eyebrow, title, sub, actions, className = '' }) => (
  <header className={`page-head ${className}`.trim()}>
    <div>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>}
      {typeof title === 'string' ? <h1 className="h1">{title}</h1> : title}
      {sub && <p className="dim" style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.5, maxWidth: 720 }}>{sub}</p>}
    </div>
    {actions && <div className="page-head-actions">{actions}</div>}
  </header>
);

export default PageHead;
