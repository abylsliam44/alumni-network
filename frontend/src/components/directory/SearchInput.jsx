import { useState, useEffect, useRef } from 'react';

const SearchInput = ({ value, onChange, placeholder = "Search..." }) => {
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={`dsearch ${isFocused ? 'focused' : ''} ${localValue ? 'has-value' : ''}`}>
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        className="dsearch-input"
      />
      {localValue && (
        <button 
          type="button"
          className="dsearch-clear" 
          onClick={handleClear}
          tabIndex={-1}
        >
          Clear
        </button>
      )}
    </div>
  );
};

export default SearchInput;
