import React, { useState } from 'react';

const Avatar = ({ src, alt, size = 'md', className = '', ...props }) => {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: { width: '32px', height: '32px', fontSize: '0.75rem' },
    md: { width: '48px', height: '48px', fontSize: '1rem' },
    lg: { width: '80px', height: '80px', fontSize: '1.5rem' },
    xl: { width: '128px', height: '128px', fontSize: '2rem' },
  };

  const style = {
    ...sizeClasses[size],
    borderRadius: '50%',
    objectFit: 'cover',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    color: '#9ca3af',
    border: '1px solid #e5e7eb',
    ...props.style
  };

  const handleError = () => {
    setError(true);
  };

  if (src && !error) {
    return (
      <img
        src={src}
        alt={alt || 'Avatar'}
        className={`avatar ${className}`}
        style={{ ...style, border: className.includes('profile-avatar') ? '4px solid white' : style.border }}
        onError={handleError}
        {...props}
      />
    );
  }

  return (
    <div className={`avatar-placeholder ${className}`} style={{ ...style, border: className.includes('profile-avatar') ? '4px solid white' : style.border }} {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        style={{ width: '60%', height: '60%' }}
      >
        <path
          fillRule="evenodd"
          d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
};

export default Avatar;
