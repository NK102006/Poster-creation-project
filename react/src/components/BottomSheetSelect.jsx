import React, { useState, useEffect, useRef } from 'react';
import styles from './BottomSheetSelect.module.css';

export default function BottomSheetSelect({ 
  value, 
  onChange, 
  options = [], 
  placeholder = 'Please Select...',
  className = '',
  disabled = false,
  name,
  id
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find(opt => opt.value === value) || options.find(opt => opt.value === Number(value));
  const displayValue = selectedOption ? selectedOption.label : '';

  const handleToggle = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const handleSelect = (optionValue) => {
    if (onChange) {
      onChange({ target: { value: optionValue, name } });
    }
    setIsOpen(false);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <div className={`${styles.container} ${className}`} ref={containerRef} id={id}>
      {/* Mock Input Field */}
      <div 
        className={`${styles.mockInput} ${disabled ? styles.disabled : ''} ${isOpen ? styles.active : ''}`}
        onClick={handleToggle}
      >
        <span className={displayValue ? styles.value : styles.placeholder} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedOption?.colorDot && (
            <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: selectedOption.colorDot, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
          )}
          {displayValue || placeholder}
        </span>
        <svg className={`${styles.chevron} ${isOpen ? styles.rotated : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Select Native fallback for standard form submission if needed */}
      <select 
        name={name} 
        value={value} 
        onChange={() => {}} 
        style={{ display: 'none' }}
        disabled={disabled}
      >
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className={styles.dropdownMenu}>
          {options.length === 0 ? (
            <div className={styles.noOptions}>No options available</div>
          ) : (
            options.map((opt, index) => (
              <div 
                key={index} 
                className={`${styles.option} ${String(opt.value) === String(value) ? styles.selected : ''}`}
                onClick={() => handleSelect(opt.value)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {opt.colorDot && (
                <span style={{ display: 'inline-block', width: '18px', height: '18px', borderRadius: '4px', backgroundColor: opt.colorDot, flexShrink: 0, border: '1px solid rgba(0,0,0,0.1)' }} />
                )}
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
