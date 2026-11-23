import { useEffect, useId, useMemo, useRef, useState } from 'react';
import styles from './DatePicker.module.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toIso(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIso(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const raw = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDisplay(date) {
  if (!date) return '';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}/${date.getFullYear()}`;
}

function formatRangeText(start, end) {
  if (!start && !end) return '';
  if (start && end) return `${formatDisplay(start)} – ${formatDisplay(end)}`;
  return formatDisplay(start || end);
}

function monthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildMonthCells(viewMonth) {
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function normalizeRange(value) {
  if (Array.isArray(value)) {
    return [parseIso(value[0]), parseIso(value[1])];
  }
  if (typeof value === 'string' && value.includes(' – ')) {
    const [a, b] = value.split(' – ');
    return [parseIso(a), parseIso(b)];
  }
  const single = parseIso(value);
  return [single, null];
}

function emitChange(onChange, start, end) {
  if (!onChange) return;
  const next = [toIso(start), toIso(end)];
  onChange({
    value: next,
    valueText: formatRangeText(start, end),
  });
}

/**
 * Range date field — calendar expands under the input (no modal popup).
 */
export default function Datepicker({
  value = '',
  onChange,
  select = 'date',
  controls = ['calendar'],
  touchUi = false,
  display,
  showOnClick = true,
  showOnFocus = true,
  isOpen,
  onClose,
  onOpen,
  inputComponent = 'input',
  inputProps = {},
  placeholder = 'Choose date',
  id,
  compact = false,
}) {
  void controls;
  void inputComponent;
  void display;
  void touchUi;

  const autoId = useId();
  const inputId = id || autoId;
  const rootRef = useRef(null);
  const isRange = select === 'range';
  const isOpenControlled = typeof isOpen === 'boolean';
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpenControlled ? isOpen : internalOpen;

  const [committedStart, committedEnd] = useMemo(() => normalizeRange(value), [value]);
  const [draftStart, setDraftStart] = useState(committedStart);
  const [draftEnd, setDraftEnd] = useState(committedEnd);
  const [activeTab, setActiveTab] = useState('start');
  const [viewMonth, setViewMonth] = useState(() => startOfDay(committedStart || new Date()));

  useEffect(() => {
    if (!open) return;
    setDraftStart(committedStart);
    setDraftEnd(committedEnd);
    setActiveTab(committedStart && !committedEnd ? 'end' : 'start');
    setViewMonth(startOfDay(committedStart || committedEnd || new Date()));
  }, [open, committedStart, committedEnd]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        if (!isOpenControlled) setInternalOpen(false);
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onDocPointer);
    return () => document.removeEventListener('mousedown', onDocPointer);
  }, [open, isOpenControlled, onClose]);

  const openPicker = () => {
    if (isOpenControlled) {
      onOpen?.();
      return;
    }
    setInternalOpen(true);
    onOpen?.();
  };

  const closePicker = () => {
    if (!isOpenControlled) setInternalOpen(false);
    onClose?.();
  };

  const handleInputActivate = () => {
    if (!showOnClick && !showOnFocus) return;
    openPicker();
  };

  const commitRange = (start, end) => {
    if (isRange) emitChange(onChange, start, end);
    else emitChange(onChange, start, null);
  };

  const handleDayClick = (day) => {
    if (!day) return;
    const next = startOfDay(day);
    if (!isRange) {
      setDraftStart(next);
      setDraftEnd(null);
      commitRange(next, null);
      closePicker();
      return;
    }

    if (activeTab === 'start') {
      const nextEnd = draftEnd && next > draftEnd ? null : draftEnd;
      setDraftStart(next);
      if (nextEnd !== draftEnd) setDraftEnd(nextEnd);
      setActiveTab('end');
      return;
    }

    if (!draftStart || next < draftStart) {
      setDraftStart(next);
      setDraftEnd(null);
      setActiveTab('end');
      return;
    }

    setDraftEnd(next);
    commitRange(draftStart, next);
    closePicker();
  };

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const inputPlaceholder = inputProps.placeholder || placeholder;
  const inputClassName = [styles.input, inputProps.className].filter(Boolean).join(' ');
  const displayValue = formatRangeText(committedStart, committedEnd);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${isRange ? styles.rangeRoot : ''} ${compact ? styles.compact : ''}`}
    >
      <input
        id={inputId}
        type="text"
        className={inputClassName}
        placeholder={inputPlaceholder}
        value={displayValue}
        readOnly
        onClick={showOnClick ? handleInputActivate : undefined}
        onFocus={showOnFocus ? handleInputActivate : undefined}
        disabled={Boolean(inputProps.disabled)}
        aria-expanded={open}
        aria-haspopup="true"
      />

      {open ? (
        <div className={styles.dropdown} role="dialog" aria-label="Select date range">
          {isRange && (
            <div className={styles.sheetHeader}>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'start' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('start')}
              >
                <span className={styles.tabLabel}>Start</span>
                <span className={styles.tabValue}>{formatDisplay(draftStart) || '—'}</span>
              </button>
              <button
                type="button"
                className={`${styles.tab} ${activeTab === 'end' ? styles.tabActive : ''}`}
                onClick={() => setActiveTab('end')}
              >
                <span className={styles.tabLabel}>End</span>
                <span className={styles.tabValue}>{formatDisplay(draftEnd) || '—'}</span>
              </button>
            </div>
          )}

          <div className={styles.monthBar}>
            <span className={styles.monthTitle}>{monthLabel(viewMonth)}</span>
            <div className={styles.monthNav}>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="Previous month"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <button
                type="button"
                className={styles.navBtn}
                aria-label="Next month"
                onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              >
                ›
              </button>
            </div>
          </div>

          <div className={styles.weekRow}>
            {WEEKDAYS.map((day) => (
              <span key={day} className={styles.weekday}>
                {day}
              </span>
            ))}
          </div>

          <div className={styles.dayGrid}>
            {cells.map((day, index) => {
              if (!day) return <span key={`e-${index}`} className={styles.dayEmpty} />;
              const iso = toIso(day);
              const isStart = sameDay(day, draftStart);
              const isEnd = sameDay(day, draftEnd);
              const inRange =
                draftStart &&
                draftEnd &&
                day.getTime() >= draftStart.getTime() &&
                day.getTime() <= draftEnd.getTime();
              const className = [
                styles.day,
                inRange ? styles.dayInRange : '',
                isStart ? styles.dayStart : '',
                isEnd ? styles.dayEnd : '',
                isStart || isEnd ? styles.daySelected : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button key={iso} type="button" className={className} onClick={() => handleDayClick(day)}>
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { Datepicker as DatePicker };
