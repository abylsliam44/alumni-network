import { useState } from 'react';

const TONES = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'];

const initialsFromName = (name) =>
  (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const toneFromName = (name) => {
  if (!name) return TONES[0];
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return TONES[Math.abs(h) % TONES.length];
};

const sizeAlias = (size) => {
  if (!size) return 'm';
  if (['xs', 's', 'm', 'l', 'xl', 'xxl'].includes(size)) return size;
  if (size === 'sm') return 's';
  if (size === 'md') return 'm';
  if (size === 'lg') return 'l';
  return 'm';
};

const Avatar = ({ src, alt, name, size = 'm', tone, monogram, className = '', style, ...rest }) => {
  const [error, setError] = useState(false);
  const initials = monogram || initialsFromName(name || alt || '');
  const palette = tone || toneFromName(name || alt || initials);
  const cls = `avatar ${sizeAlias(size)} ${palette} ${className}`.trim();

  if (src && !error) {
    return (
      <div className={cls} style={style} {...rest}>
        <img src={src} alt={alt || name || 'Avatar'} onError={() => setError(true)} />
      </div>
    );
  }

  return (
    <div className={cls} style={style} {...rest}>
      <span>{initials}</span>
    </div>
  );
};

export default Avatar;
