const Button = ({ children, variant = 'default', size = '', className = '', as: As = 'button', ...props }) => {
  const variantClass = variant === 'default' ? '' : variant;
  const sizeClass = size ? size : '';
  return (
    <As className={`btn ${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {children}
    </As>
  );
};

export default Button;
