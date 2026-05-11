const Pill = ({ children, tone, dot = false, className = '', ...rest }) => (
  <span className={`pill ${tone || ''} ${className}`.trim()} {...rest}>
    {dot && <span className="dot" />}
    {children}
  </span>
);

export default Pill;
