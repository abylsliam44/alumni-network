const Alert = ({ type = 'success', children, className = '' }) => {
  const cls = type === 'error' || type === 'danger' ? 'error-message' : 'success-message';
  return <div className={`${cls} ${className}`.trim()}>{children}</div>;
};

export default Alert;
