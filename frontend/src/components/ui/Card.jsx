const Card = ({ children, className = '', ...rest }) => (
  <div className={`panel ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardHead = ({ children, className = '', ...rest }) => (
  <div className={`panel-head ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardBody = ({ children, className = '', ...rest }) => (
  <div className={`panel-body ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export default Card;
