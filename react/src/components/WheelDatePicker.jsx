import React, { useState, useEffect, useRef } from 'react';
import styles from './WheelDatePicker.module.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to get number of days in month
const getDaysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

export default function WheelDatePicker({ value, onChange, placeholder = 'Please select...', id }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial value (YYYY-MM-DD)
  const initialDate = value ? new Date(value) : new Date();
  
  // Working state while picking
  const [tempMonth, setTempMonth] = useState(initialDate.getMonth());
  const [tempDay, setTempDay] = useState(initialDate.getDate());
  const [tempYear, setTempYear] = useState(initialDate.getFullYear());

  const monthRef = useRef(null);
  const dayRef = useRef(null);
  const yearRef = useRef(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 20 }, (_, i) => currentYear - 10 + i); // 10 years past, 9 future
  const daysInMonth = getDaysInMonth(tempYear, tempMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Sync tempDay if month changes to a shorter month
  useEffect(() => {
    if (tempDay > daysInMonth) {
      setTempDay(daysInMonth);
    }
  }, [tempMonth, tempYear, daysInMonth, tempDay]);

  const handleToggle = () => {
    if (!isOpen) {
      const d = value ? new Date(value) : new Date();
      setTempMonth(d.getMonth());
      setTempDay(d.getDate());
      setTempYear(d.getFullYear());
    }
    setIsOpen(!isOpen);
  };

  const handleSet = () => {
    if (onChange) {
      const mm = String(tempMonth + 1).padStart(2, '0');
      const dd = String(tempDay).padStart(2, '0');
      onChange({ target: { value: `${tempYear}-${mm}-${dd}` } });
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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle scroll snapping detection
  const handleScroll = (e, setter, itemsArray) => {
    const el = e.target;
    // Each item is 40px height
    const index = Math.round(el.scrollTop / 40);
    if (itemsArray[index] !== undefined) {
      // In a real sophisticated component, we might debounce this. 
      // For smooth scrolling, we just update state gently.
      setter(itemsArray[index]);
    }
  };

  // Initial scroll position when opened
  useEffect(() => {
    if (isOpen) {
      if (monthRef.current) monthRef.current.scrollTop = tempMonth * 40;
      if (dayRef.current) dayRef.current.scrollTop = (tempDay - 1) * 40;
      if (yearRef.current) yearRef.current.scrollTop = years.indexOf(tempYear) * 40;
    }
  }, [isOpen]);

  let displayValue = '';
  if (value) {
    const d = new Date(value);
    displayValue = `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
  }

  return (
    <div className={styles.container} ref={containerRef} id={id}>
      <div className={`${styles.mockInput} ${isOpen ? styles.active : ''}`} onClick={handleToggle}>
        <span className={displayValue ? styles.value : styles.placeholder}>
          {displayValue || placeholder}
        </span>
      </div>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <div className={styles.pickerWheels}>
            {/* Month Wheel */}
            <div 
              className={styles.wheelColumn} 
              ref={monthRef}
              onScroll={(e) => handleScroll(e, (v) => setTempMonth(MONTHS.indexOf(v)), MONTHS)}
            >
              <div className={styles.wheelPad} />
              {MONTHS.map((m, i) => (
                <div key={m} className={`${styles.wheelItem} ${i === tempMonth ? styles.selected : ''}`}>
                  {m}
                </div>
              ))}
              <div className={styles.wheelPad} />
            </div>

            {/* Day Wheel */}
            <div 
              className={styles.wheelColumn} 
              ref={dayRef}
              onScroll={(e) => handleScroll(e, setTempDay, days)}
            >
              <div className={styles.wheelPad} />
              {days.map(d => (
                <div key={d} className={`${styles.wheelItem} ${d === tempDay ? styles.selected : ''}`}>
                  {String(d).padStart(2, '0')}
                </div>
              ))}
              <div className={styles.wheelPad} />
            </div>

            {/* Year Wheel */}
            <div 
              className={styles.wheelColumn} 
              ref={yearRef}
              onScroll={(e) => handleScroll(e, setTempYear, years)}
            >
              <div className={styles.wheelPad} />
              {years.map(y => (
                <div key={y} className={`${styles.wheelItem} ${y === tempYear ? styles.selected : ''}`}>
                  {y}
                </div>
              ))}
              <div className={styles.wheelPad} />
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.btnCancel} onClick={() => setIsOpen(false)}>Cancel</button>
            <button className={styles.btnSet} onClick={handleSet}>Set</button>
          </div>
        </div>
      )}
    </div>
  );
}
