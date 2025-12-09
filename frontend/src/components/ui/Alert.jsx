const Alert = ({ type = 'success', children }) => {
  const cls = `alert ${type === 'error' ? 'alert-error' : 'alert-success'}`;
  return <div className={cls}>{children}</div>;
};

export default Alert;
