const PageIntro = ({ eyebrow, title, subtitle, side, className = '' }) => (
  <header className={`page-head ${className}`.trim()}>
    <div>
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>}
      {typeof title === 'string' ? <h1 className="h1" style={{ fontSize: 32 }}>{title}</h1> : title}
      {subtitle && <p className="dim" style={{ margin: '12px 0 0', fontSize: 14, lineHeight: 1.5, maxWidth: 720 }}>{subtitle}</p>}
    </div>
    {side && <div className="page-head-actions">{side}</div>}
  </header>
);

export default PageIntro;
