const PageIntro = ({ eyebrow, title, subtitle, side, className = '' }) => {
  const rootClassName = ['page-intro', className].filter(Boolean).join(' ');

  return (
    <header className={rootClassName}>
      <div className="page-intro-copy">
        {eyebrow && <div className="page-intro-eyebrow">{eyebrow}</div>}
        <h1 className="page-intro-title">{title}</h1>
        {subtitle && <p className="page-intro-subtitle">{subtitle}</p>}
      </div>

      {side && <div className="page-intro-side">{side}</div>}
    </header>
  );
};

export default PageIntro;
