import { useState, useEffect } from 'react';
import Input from '../ui/Input';

const SearchInput = ({ value, onChange, placeholder = "Search..." }) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [localValue, onChange, value]);

  return (
    <div className="search-input-container">
      <Input
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder}
        className="search-input"
      />
    </div>
  );
};

export default SearchInput;
