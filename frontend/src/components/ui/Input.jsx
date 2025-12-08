import React from 'react';

const Input = ({ label, type = 'text', ...props }) => {
  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      <input className="form-input" type={type} {...props} />
    </div>
  );
};

export default Input;
