import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './DatePicker.module.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function parseIsoDate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sameDay(a, b) {
  return a && b
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatDisplay(value) {
  const date = parseIsoDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function buildMonthCells(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startOffset; i += 1) {
    cells.push({ key: `pad-${i}`, empty: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      key: `day-${day}`,
      empty: false,
      date: new Date(year, month, day),
    });
  }
  return cells;
}

export default function DatePicker({
  label,
  value = '',
  onChange,
  placeholder = 'Select date',
  id,
}) {
  const rootRef = useRef(null);
  const selected = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selected || new Date());

  useEffect(() => {
    if (selected) setViewDate(selected);
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const cells = useMemo(() => buildMonthCells(viewDate), [viewDate]);
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const inputId = id || `date-${label || 'picker'}`.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className={styles.root} ref={rootRef}>
      {label ? (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <button
        id={inputId}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? styles.value : styles.placeholder}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 3.5v3M16 3.5v3M3.5 9.5h17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className={styles.popover} role="dialog" aria-label={label || 'Choose date'}>
          <div className={styles.monthBar}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <strong>
              {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
            </strong>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Next month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>

          <div className={styles.weekdays}>
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className={styles.grid}>
            {cells.map((cell) => {
              if (cell.empty) {
                return <span key={cell.key} className={styles.empty} />;
              }
              const isSelected = sameDay(cell.date, selected);
              const isToday = sameDay(cell.date, today);
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={`${styles.day} ${isSelected ? styles.daySelected : ''} ${isToday ? styles.dayToday : ''}`}
                  onClick={() => {
                    onChange?.(toIsoDate(cell.date));
                    setOpen(false);
                  }}
                >
                  {cell.date.getDate()}
                </button>
              );
            })}
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={() => {
                onChange?.('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className={styles.footerBtn}
              onClick={() => {
                onChange?.(toIsoDate(today));
                setViewDate(today);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
