import { useState, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';

const SearchInput = ({ value, onChange, placeholder = 'Search…' }) => {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setLocalValue(value); }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) onChange(localValue);
    }, 400);
    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  return (
    <div className="search-input" style={{ position: 'relative', minWidth: 240, flex: 1 }}>
      <Icon name="search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
      <input
        ref={inputRef}
        type="search"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 34, paddingRight: localValue ? 50 : 12 }}
      />
      {localValue && (
        <button
          type="button"
          onClick={() => { setLocalValue(''); onChange(''); inputRef.current?.focus(); }}
          className="iconbtn"
          style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24 }}
          tabIndex={-1}
          aria-label="Clear"
        >
          <Icon name="close" size={12} />
        </button>
      )}
    </div>
  );
};

export default SearchInput;
