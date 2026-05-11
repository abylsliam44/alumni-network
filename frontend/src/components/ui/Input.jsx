const Input = ({ label, type = 'text', help, error, className = '', ...props }) => (
  <div className="form-group">
    {label && <label className="form-label">{label}</label>}
    <input className={`input ${className}`.trim()} type={type} {...props} />
    {help && <div className="help">{help}</div>}
    {error && <div className="help" style={{ color: 'var(--err)' }}>{error}</div>}
  </div>
);

export default Input;
