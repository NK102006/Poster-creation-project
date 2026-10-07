import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../lib/apiClient';
import { sortDoctorFields } from '../lib/doctorFields';
import { POSTER_CANVAS } from '../lib/posterFooterLayout';
import {
  CANVAS_RATIO,
  FIELD_MIN_H,
  FIELD_MIN_W,
  FIELD_SHAPES,
  chooseTextColor,
  createImageSampler,
  fieldBoxStyle,
  isImageField,
  isSquareShape,
  posterImageUrl,
  shapeRadius,
  squareUp,
} from '../lib/posterFields';
import BottomSheetSelect from '../components/BottomSheetSelect';
import { FitText } from '../components/PosterFieldsOverlay';
import adminStyles from './AdminPortal.module.css';
import styles from './PosterDesigner.module.css';
import { confirmDialog } from '../lib/alerts';

const ASPECT = POSTER_CANVAS.width / POSTER_CANVAS.height;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HANDLES = [
  { id: 'nw', hx: -1, hy: -1 },
  { id: 'n', hx: 0, hy: -1 },
  { id: 'ne', hx: 1, hy: -1 },
  { id: 'e', hx: 1, hy: 0 },
  { id: 'se', hx: 1, hy: 1 },
  { id: 's', hx: 0, hy: 1 },
  { id: 'sw', hx: -1, hy: 1 },
  { id: 'w', hx: -1, hy: 0 },
];
const CORNER_IDS = ['nw', 'ne', 'se', 'sw'];
const DEFAULT_TEXT_COLOR = '#1a3040';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const round = (value) => Math.round(value * 100000) / 100000;

function formatWhen(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** Shows whether a designed poster still lacks a position for any active field. */
function LayoutStatus({ poster, fields }) {
  const placed = new Set((poster.fields || []).map((f) => f.key));
  const off = new Set(poster.disabledFields || []);
  const missing = fields.filter((f) => !placed.has(f.key) && !off.has(f.key));
  if (missing.length === 0) return <span className={styles.statusOk}>All fields placed</span>;
  return (
    <span className={styles.statusWarn} title={missing.map((f) => f.label).join(', ')}>
      {missing.length} new field{missing.length === 1 ? '' : 's'} to place
    </span>
  );
}

function FieldGroup({ title, fields, rects, disabled, activeKey, onSelect, onToggle, renderExtra }) {
  if (fields.length === 0) return null;
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <div className={styles.fieldList}>
        {fields.map((field) => {
          const isOff = disabled.has(field.key);
          const isPlaced = Boolean(rects[field.key]);
          const isActive = activeKey === field.key && !isOff;
          return (
            <Fragment key={field.key}>
            <div
              role="button"
              tabIndex={isOff ? -1 : 0}
              aria-pressed={isActive}
              aria-disabled={isOff}
              className={`${styles.fieldRow} ${isActive ? styles.fieldRowActive : ''} ${isOff ? styles.fieldRowOff : ''}`}
              onClick={() => !isOff && onSelect(field.key)}
              onKeyDown={(event) => {
                if (isOff || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                onSelect(field.key);
              }}
            >
              <span
                className={`${styles.dot} ${isPlaced && !isOff ? styles.dotPlaced : ''}`}
                aria-hidden="true"
              />
              <span className={styles.fieldText}>
                <strong>{field.label}</strong>
                <small>
                  {isOff ? 'Not on this poster' : isPlaced ? 'Placed' : 'Select, then drag on the poster'}
                </small>
              </span>
              <label
                className={styles.toggle}
                title={isOff ? 'Include on this poster' : 'Disable on this poster'}
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={!isOff}
                  onChange={() => onToggle(field.key)}
                  aria-label={`${field.label} on this poster`}
                />
                <span className={styles.toggleTrack} />
              </label>
            </div>
            {isActive && renderExtra?.(field)}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

export default function PosterDesigner({ onClose, onSaved, categories = [], themes = [], initialPoster = null }) {
  const [doctorFields, setDoctorFields] = useState([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);

  const [draftId, setDraftId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageSrc, setImageSrc] = useState('');
  const [imageRatio, setImageRatio] = useState(null);
  const [editingStatus, setEditingStatus] = useState(null); // status of the poster being edited
  const [sampler, setSampler] = useState(null);
  const [shapes, setShapes] = useState({});
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [month, setMonth] = useState('');
  const [rects, setRects] = useState({});
  const [disabled, setDisabled] = useState(() => new Set());
  const [activeKey, setActiveKey] = useState(null);
  const [drawing, setDrawing] = useState(null);
  const [dirty, setDirty] = useState(false);

  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [picker, setPicker] = useState(null); // 'drafts' | 'existing'
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [stageEl, setStageEl] = useState(null);
  const frameRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragRef = useRef(null);
  const objectUrlRef = useRef('');

  // Only fields the superadmin has kept enabled are available to place.
  useEffect(() => {
    let cancelled = false;
    apiRequest('/doctor-fields')
      .then((result) => {
        if (cancelled) return;
        setDoctorFields(sortDoctorFields((result.fields || []).filter((f) => f.enabled)));
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load fields'))
      .finally(() => !cancelled && setFieldsLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  // Fit the 4:5 canvas inside whatever room the stage has.
  useLayoutEffect(() => {
    if (!stageEl) return undefined;
    const measure = () => {
      const { width, height } = stageEl.getBoundingClientRect();
      const availW = Math.max(width - 48, 0);
      const availH = Math.max(height - 72, 0);
      const frameW = Math.min(availW, availH * ASPECT);
      setStageSize({ width: frameW, height: frameW / ASPECT });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stageEl);
    return () => observer.disconnect();
  }, [stageEl]);

  const standardFields = useMemo(() => doctorFields.filter((f) => f.isStandard), [doctorFields]);
  const customFields = useMemo(() => doctorFields.filter((f) => !f.isStandard), [doctorFields]);
  const fieldByKey = useMemo(() => new Map(doctorFields.map((f) => [f.key, f])), [doctorFields]);

  const requiredFields = useMemo(() => doctorFields.filter((f) => !disabled.has(f.key)), [doctorFields, disabled]);
  const placedCount = requiredFields.filter((f) => rects[f.key]).length;
  const missingCount = requiredFields.length - placedCount;

  const activeField = activeKey ? fieldByKey.get(activeKey) : null;
  const activeRect = activeKey ? rects[activeKey] : null;

  let blocker = '';
  if (!imageSrc) blocker = 'Import a poster image to begin.';
  else if (!category) blocker = 'Choose a category for this poster.';
  else if (!color) blocker = 'Choose a theme for this poster.';
  else if (!month) blocker = 'Choose a month for this poster.';
  else if (requiredFields.length === 0) blocker = 'Enable at least one field.';
  else if (missingCount > 0) blocker = `${missingCount} field${missingCount === 1 ? '' : 's'} still need a position.`;

  const touch = () => setDirty(true);

  const shapeOf = (key) => shapes[key] || 'rectangle';
  const themeColor = useMemo(
    () => themes.find((t) => t.name?.toLowerCase() === color.toLowerCase())?.headerBg || DEFAULT_TEXT_COLOR,
    [themes, color]
  );
  // Text colour follows the chosen theme and adapts to the poster area under each box.
  const textColors = useMemo(() => {
    const map = {};
    Object.entries(rects).forEach(([key, rect]) => {
      map[key] = chooseTextColor(sampler ? sampler(rect) : null, themeColor);
    });
    return map;
  }, [rects, sampler, themeColor]);

  const selectField = (key) => {
    setActiveKey((prev) => (prev === key ? null : key));
  };

  const toggleField = (key) => {
    touch();
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setActiveKey((prev) => (prev === key ? null : prev));
  };

  const updateRect = (key, patch) => {
    touch();
    setRects((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], ...patch } } : prev));
  };

  const removeRect = (key) => {
    touch();
    setRects((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setImage = (src, file) => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
    if (file) objectUrlRef.current = src;
    setImageSrc(src);
    setImageFile(file);
    setImageRatio(null);
    setSampler(null);
  };

  const setShape = (key, shape) => {
    touch();
    setShapes((prev) => ({ ...prev, [key]: shape }));
    if (isSquareShape(shape)) {
      setRects((prev) => (prev[key] ? { ...prev, [key]: squareUp(prev[key]) } : prev));
    }
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setError('');
    setImage(URL.createObjectURL(file), file);
    touch();
  };

  const resetAll = () => {
    setImage('', null);
    setDraftId(null);
    setEditingStatus(null);
    setCategory('');
    setColor('');
    setMonth('');
    setRects({});
    setShapes({});
    setDisabled(new Set());
    setActiveKey(null);
    setDirty(false);
    setError('');
  };

  const applyDraft = (poster) => {
    setImage(posterImageUrl(poster.posterlink), null);
    setDraftId(poster._id);
    setEditingStatus(poster.status === 'draft' ? 'draft' : 'published');
    setCategory(poster.category || '');
    setColor(poster.color || '');
    setMonth(poster.month || '');
    const map = {};
    const shapeMap = {};
    (poster.fields || []).forEach((f) => {
      map[f.key] = { x: f.x, y: f.y, w: f.w, h: f.h };
      shapeMap[f.key] = f.shape || 'rectangle';
    });
    setRects(map);
    setShapes(shapeMap);
    setDisabled(new Set(poster.disabledFields || []));
    setActiveKey(null);
    setDirty(false);
    setError('');
  };

  const requestClose = useCallback(async () => {
    if (dirty && !(await confirmDialog({
      title: 'Discard changes?',
      text: 'You have unsaved changes.',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      danger: true,
    }))) return;
    onClose();
  }, [dirty, onClose]);

  const loadPicker = async (kind) => {
    setPickerLoading(true);
    try {
      const result = await apiRequest(kind === 'drafts' ? '/superadmin/posters?status=draft' : '/superadmin/posters');
      const list = result.posters || [];
      setPickerItems(kind === 'drafts' ? list : list.filter((p) => (p.fields || []).length > 0));
    } catch (err) {
      setError(err.message || 'Could not load posters');
    } finally {
      setPickerLoading(false);
    }
  };

  const openPicker = (kind) => {
    setPicker(kind);
    setPickerItems([]);
    loadPicker(kind);
  };

  // Opened from Edit on the Posters page: load that poster straight into the designer.
  useEffect(() => {
    if (initialPoster) applyDraft(initialPoster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closePicker = () => setPicker(null);

  const pickItem = async (poster) => {
    if (dirty && !(await confirmDialog({
      title: 'Discard changes?',
      text: 'You have unsaved changes. Discard them and continue?',
      confirmText: 'Discard',
      cancelText: 'Keep editing',
      danger: true,
    }))) return;
    applyDraft(poster);
    setPicker(null);
  };

  const deleteDraft = async (poster) => {
    if (!(await confirmDialog({
      title: 'Delete this draft?',
      text: 'This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    }))) return;
    try {
      await apiRequest(`/superadmin/posters/${poster._id}`, { method: 'DELETE' });
      if (poster._id === draftId) resetAll();
      loadPicker('drafts');
    } catch (err) {
      setError(err.message || 'Could not delete draft');
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (picker) {
        if (event.key === 'Escape') closePicker();
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '');
      if (event.key === 'Escape') {
        if (activeKey) setActiveKey(null);
        else requestClose();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !typing && activeKey && rects[activeKey]) {
        event.preventDefault();
        removeRect(activeKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // —— Pointer interaction on the poster canvas ——
  const toFraction = (event) => {
    const box = frameRef.current.getBoundingClientRect();
    return {
      x: clamp((event.clientX - box.left) / box.width, 0, 1),
      y: clamp((event.clientY - box.top) / box.height, 0, 1),
    };
  };

  const onFramePointerDown = (event) => {
    if (event.button !== 0 || !imageSrc || !activeKey) return;
    frameRef.current.setPointerCapture(event.pointerId);
    const start = toFraction(event);
    dragRef.current = { mode: 'draw', key: activeKey, start, shape: shapeOf(activeKey) };
    setDrawing({ x: start.x, y: start.y, w: 0, h: 0 });
  };

  const onRectPointerDown = (event, key) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setActiveKey(key);
    frameRef.current.setPointerCapture(event.pointerId);
    dragRef.current = { mode: 'move', key, start: toFraction(event), orig: rects[key] };
  };

  const onHandlePointerDown = (event, key, handle) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setActiveKey(key);
    frameRef.current.setPointerCapture(event.pointerId);
    dragRef.current = { mode: 'resize', key, handle, start: toFraction(event), orig: rects[key], shape: shapeOf(key) };
  };

  const onFramePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toFraction(event);

    if (drag.mode === 'draw') {
      let box = {
        x: Math.min(drag.start.x, point.x),
        y: Math.min(drag.start.y, point.y),
        w: Math.abs(point.x - drag.start.x),
        h: Math.abs(point.y - drag.start.y),
      };
      if (isSquareShape(drag.shape)) {
        box = squareUp(box);
        if (point.x < drag.start.x) box.x = drag.start.x - box.w;
        if (point.y < drag.start.y) box.y = drag.start.y - box.h;
      }
      setDrawing(box);
      return;
    }

    const dx = point.x - drag.start.x;
    const dy = point.y - drag.start.y;
    const { orig } = drag;

    if (drag.mode === 'move') {
      updateRect(drag.key, {
        x: round(clamp(orig.x + dx, 0, 1 - orig.w)),
        y: round(clamp(orig.y + dy, 0, 1 - orig.h)),
      });
      return;
    }

    if (isSquareShape(drag.shape)) {
      // Corner drag from the opposite corner, keeping the box square.
      const anchorX = drag.handle.hx === 1 ? orig.x : orig.x + orig.w;
      const anchorY = drag.handle.hy === 1 ? orig.y : orig.y + orig.h;
      const growsRight = drag.handle.hx === 1;
      const growsDown = drag.handle.hy === 1;
      const maxW = growsRight ? 1 - anchorX : anchorX;
      const maxH = growsDown ? 1 - anchorY : anchorY;
      const side = clamp(
        Math.min(Math.abs(point.x - anchorX), Math.abs(point.y - anchorY) / CANVAS_RATIO),
        FIELD_MIN_W,
        Math.min(maxW, maxH / CANVAS_RATIO)
      );
      updateRect(drag.key, {
        x: round(growsRight ? anchorX : anchorX - side),
        y: round(growsDown ? anchorY : anchorY - side * CANVAS_RATIO),
        w: round(side),
        h: round(side * CANVAS_RATIO),
      });
      return;
    }

    let left = orig.x;
    let right = orig.x + orig.w;
    let top = orig.y;
    let bottom = orig.y + orig.h;
    if (drag.handle.hx === -1) left = clamp(left + dx, 0, right - FIELD_MIN_W);
    if (drag.handle.hx === 1) right = clamp(right + dx, left + FIELD_MIN_W, 1);
    if (drag.handle.hy === -1) top = clamp(top + dy, 0, bottom - FIELD_MIN_H);
    if (drag.handle.hy === 1) bottom = clamp(bottom + dy, top + FIELD_MIN_H, 1);
    updateRect(drag.key, { x: round(left), y: round(top), w: round(right - left), h: round(bottom - top) });
  };

  const onFramePointerUp = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (frameRef.current?.hasPointerCapture(event.pointerId)) {
      frameRef.current.releasePointerCapture(event.pointerId);
    }
    if (drag?.mode !== 'draw') return;

    const box = drawing;
    setDrawing(null);
    if (!box || box.w < FIELD_MIN_W || box.h < FIELD_MIN_H) return;
    touch();
    setRects((prev) => ({
      ...prev,
      [drag.key]: {
        x: round(box.x),
        y: round(box.y),
        w: round(box.w),
        h: round(box.h),
      },
    }));
  };

  // —— Saving ——
  const save = async (status) => {
    setError('');
    if (status === 'published' && blocker) {
      setError(blocker);
      return;
    }
    if (status === 'draft' && !imageSrc) {
      setError('Import a poster image before saving a draft.');
      return;
    }

    const placed = doctorFields
      .filter((f) => rects[f.key] && (status === 'draft' || !disabled.has(f.key)))
      .map((f) => ({
        key: f.key,
        type: f.type,
        ...rects[f.key],
        shape: isImageField(f) ? shapeOf(f.key) : 'rectangle',
        color: textColors[f.key] || DEFAULT_TEXT_COLOR,
      }));

    const body = new FormData();
    if (imageFile) body.append('posterFile', imageFile);
    body.append('category', category);
    body.append('color', color);
    body.append('month', month);
    body.append('enabled', 'true');
    body.append('status', status);
    body.append('fields', JSON.stringify(placed));
    body.append('disabledFields', JSON.stringify([...disabled]));

    setSaving(status);
    try {
      await apiRequest(draftId ? `/superadmin/posters/${draftId}` : '/superadmin/posters', {
        method: draftId ? 'PUT' : 'POST',
        body,
      });
      setDirty(false);
      const wasPublished = editingStatus === 'published';
      onSaved(
        status === 'draft'
          ? 'Draft saved. Find it under Continue draft.'
          : wasPublished
            ? 'Poster updated.'
            : 'Poster created and published.'
      );
    } catch (err) {
      setError(err.message || 'Could not save poster');
    } finally {
      setSaving('');
    }
  };

  const categoryOptions = [
    ...categories.filter((c) => c.enabled !== false).map((c) => ({ label: c.name, value: c.name })),
    ...(category && !categories.some((c) => c.name.toLowerCase() === category.toLowerCase())
      ? [{ label: `${category} (Current)`, value: category }]
      : []),
  ];
  const themeOptions = [
    ...themes.filter((t) => t.enabled !== false).map((t) => ({ label: t.name, value: t.name, colorDot: t.accentColor || t.headerBg })),
    ...(color && !themes.some((t) => t.name.toLowerCase() === color.toLowerCase())
      ? [{ label: `${color} (Current)`, value: color }]
      : []),
  ];
  const monthOptions = MONTHS.map((m) => ({ label: m, value: m }));

  const ratioWarning = Boolean(imageRatio) && Math.abs(imageRatio - ASPECT) > 0.02;
  const frameStyle = { width: stageSize.width, height: stageSize.height, containerType: 'size' };

  const pickerModal = (
    <div className={styles.draftsOverlay} onClick={closePicker}>
            <div
              className={styles.draftsModal}
              role="dialog"
              aria-modal="true"
              aria-label={picker === 'drafts' ? 'Drafts' : 'Existing posters'}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.draftsHead}>
                <div>
                  <h2 className={styles.title}>{picker === 'drafts' ? 'Drafts' : 'Existing posters'}</h2>
                  {picker === 'existing' && (
                    <p className={styles.pickerNote}>
                      Posters you designed. Pick one to change its layout, or place any fields added since.
                    </p>
                  )}
                </div>
                <button type="button" className={styles.closeBtn} onClick={closePicker} aria-label="Close list">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="5" y1="5" x2="19" y2="19" />
                    <line x1="19" y1="5" x2="5" y2="19" />
                  </svg>
                </button>
              </div>
              <div className={styles.draftsBody}>
                {pickerLoading && <p className={styles.muted}>Loading…</p>}
                {!pickerLoading && pickerItems.length === 0 && (
                  <p className={adminStyles.emptyState}>{picker === 'drafts' ? 'No drafts yet.' : 'No designed posters yet. Use Design poster to create one.'}</p>
                )}
                {pickerItems.length > 0 && (
                  <table className={styles.draftTable}>
                    <thead>
                      <tr>
                        <th>Poster</th>
                        <th>Category</th>
                        <th>{picker === 'drafts' ? 'Fields placed' : 'Theme'}</th>
                        <th>{picker === 'drafts' ? 'Last edited' : 'Layout'}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {pickerItems.map((poster) => (
                        <tr key={poster._id} onClick={() => pickItem(poster)}>
                          <td>
                            <img className={styles.draftThumb} src={posterImageUrl(poster.posterlink)} alt="" />
                          </td>
                          <td>{poster.category || '—'}</td>
                          <td>{picker === 'drafts' ? (poster.fields || []).length : poster.color || '—'}</td>
                          <td>
                            {picker === 'drafts' ? (
                              formatWhen(poster.updatedAt)
                            ) : (
                              <LayoutStatus poster={poster} fields={doctorFields} />
                            )}
                          </td>
                          <td>
                            <div className={styles.draftActions}>
                              <button type="button" className={adminStyles.editBtn} onClick={() => pickItem(poster)}>
                                {picker === 'drafts' ? 'Open' : 'Edit'}
                              </button>
                              {picker === 'drafts' && (
                                <button
                                  type="button"
                                  className={adminStyles.deleteBtn}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteDraft(poster);
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
  );

  const renderFieldExtra = (field) => {
    const placed = Boolean(rects[field.key]);
    const showShapes = isImageField(field);
    if (!showShapes && !placed) return null;
    return (
      <div className={styles.fieldExtra}>
        {showShapes && (
          <div className={styles.shapes} role="group" aria-label={`${field.label} shape`}>
            {FIELD_SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className={`${styles.shapeBtn} ${shapeOf(field.key) === shape.id ? styles.shapeBtnOn : ''}`}
                onClick={() => setShape(field.key, shape.id)}
                aria-pressed={shapeOf(field.key) === shape.id}
              >
                <span className={`${styles.shapeIcon} ${styles[`shape_${shape.id}`]}`} aria-hidden="true" />
                {shape.label}
              </button>
            ))}
          </div>
        )}
        {placed && (
          <button type="button" className={`${adminStyles.deleteBtn} ${styles.clearBtn}`} onClick={() => removeRect(field.key)}>
            Clear position
          </button>
        )}
      </div>
    );
  };

  const ui = (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Poster designer">
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <h2 className={styles.title}>
            {editingStatus === 'published' ? 'Edit poster' : draftId ? 'Continue draft' : 'Design poster'}
          </h2>
          {draftId && <span className={styles.chip}>{editingStatus === 'published' ? 'Published' : 'Draft'}</span>}
        </div>
        <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label="Close designer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        </button>
      </header>

      <div className={styles.body}>
        <aside className={styles.panel}>
          <div className={styles.panelTop}>
            <button type="button" className={adminStyles.primaryBtn} onClick={() => fileInputRef.current?.click()}>
              {imageSrc ? 'Replace image' : 'Import image'}
            </button>
            <button type="button" className={adminStyles.secondaryBtn} onClick={() => openPicker('drafts')}>
              Continue draft
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImport} />
          </div>

          <div className={styles.panelScroll}>
            {ratioWarning && (
              <p className={styles.ratioNote} role="note">
                This image is not 4:5, so users will see it cropped to fit. What you see on the poster is what they get.
              </p>
            )}
            <section className={styles.group}>
              <h3 className={styles.groupTitle}>Poster settings</h3>
              <div className={styles.settings}>
                <label className={styles.setting}>
                  <span>Category <em>*</em></span>
                  <BottomSheetSelect
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      touch();
                    }}
                    placeholder="Select category"
                    options={categoryOptions}
                  />
                </label>
                <div className={styles.settingRow}>
                  <label className={styles.setting}>
                    <span>Theme <em>*</em></span>
                    <BottomSheetSelect
                      value={color}
                      onChange={(e) => {
                        setColor(e.target.value);
                        touch();
                      }}
                      placeholder="Select theme"
                      options={themeOptions}
                    />
                  </label>
                  <label className={styles.setting}>
                    <span>Month <em>*</em></span>
                    <BottomSheetSelect
                      value={month}
                      onChange={(e) => {
                        setMonth(e.target.value);
                        touch();
                      }}
                      placeholder="Select month"
                      options={monthOptions}
                    />
                  </label>
                </div>
              </div>
            </section>

            <div className={styles.progress}>
              <div className={styles.progressHead}>
                <span>Fields placed</span>
                <strong>{placedCount} / {requiredFields.length}</strong>
              </div>
              <div className={styles.progressBar}>
                <span style={{ width: requiredFields.length ? `${(placedCount / requiredFields.length) * 100}%` : '0%' }} />
              </div>
            </div>

            {fieldsLoading && <p className={styles.muted}>Loading fields…</p>}
            {!fieldsLoading && doctorFields.length === 0 && (
              <p className={styles.muted}>No active fields. Enable fields under Doctor Fields first.</p>
            )}

            <FieldGroup
              title="Standard fields"
              fields={standardFields}
              rects={rects}
              disabled={disabled}
              activeKey={activeKey}
              onSelect={selectField}
              onToggle={toggleField}
              renderExtra={renderFieldExtra}
            />
            <FieldGroup
              title="Custom fields"
              fields={customFields}
              rects={rects}
              disabled={disabled}
              activeKey={activeKey}
              onSelect={selectField}
              onToggle={toggleField}
              renderExtra={renderFieldExtra}
            />

          </div>
        </aside>

        <main className={styles.stage} ref={setStageEl}>
          {!imageSrc ? (
            <button type="button" className={styles.empty} onClick={() => fileInputRef.current?.click()}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="9" cy="9" r="1.6" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <strong>Import a poster image</strong>
              <span>Use a poster without any doctor details on it. It is shown at the 4:5 size users see.</span>
            </button>
          ) : (
            <>
              <div className={styles.hint} aria-live="polite">
                {activeField
                  ? activeRect
                    ? `Drag to move ${activeField.label}, or draw again to replace it`
                    : `Drag a rectangle on the poster to place ${activeField.label}`
                  : 'Select a field on the left, then drag a rectangle on the poster'}
              </div>
              <div
                ref={frameRef}
                className={`${styles.frame} ${activeKey ? styles.framePlacing : ''}`}
                style={frameStyle}
                onPointerDown={onFramePointerDown}
                onPointerMove={onFramePointerMove}
                onPointerUp={onFramePointerUp}
                onPointerCancel={onFramePointerUp}
              >
                <img
                  src={imageSrc}
                  alt="Poster"
                  draggable={false}
                  className={styles.frameImage}
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImageRatio(img.naturalWidth / img.naturalHeight);
                    const fn = createImageSampler(img);
                    setSampler(() => fn);
                  }}
                />

                {doctorFields.map((field) => {
                  const rect = rects[field.key];
                  if (!rect || disabled.has(field.key)) return null;
                  const isActive = activeKey === field.key;
                  return (
                    <div
                      key={field.key}
                      className={`${styles.rect} ${isActive ? styles.rectActive : ''}`}
                      style={{ ...fieldBoxStyle(rect), borderRadius: shapeRadius(shapeOf(field.key)) }}
                      onPointerDown={(event) => onRectPointerDown(event, field.key)}
                    >
                      <div className={styles.rectLabel}>
                        <FitText
                          text={field.label}
                          color={isImageField(field) ? 'var(--color-primary-rich)' : textColors[field.key]}
                          align={isImageField(field) ? 'center' : 'left'}
                        />
                      </div>
                      {isActive &&
                        HANDLES.filter((handle) => !isSquareShape(shapeOf(field.key)) || CORNER_IDS.includes(handle.id)).map((handle) => (
                          <span
                            key={handle.id}
                            className={styles.handle}
                            style={{
                              left: `${(handle.hx + 1) * 50}%`,
                              top: `${(handle.hy + 1) * 50}%`,
                              cursor: `${handle.id}-resize`,
                            }}
                            onPointerDown={(event) => onHandlePointerDown(event, field.key, handle)}
                          />
                        ))}
                    </div>
                  );
                })}

                {drawing && (
                  <div
                    className={`${styles.rect} ${styles.rectDraft}`}
                    style={{ ...fieldBoxStyle(drawing), borderRadius: shapeRadius(shapeOf(activeKey)) }}
                  />
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <footer className={styles.footer}>
        <p className={`${styles.footNote} ${error ? styles.footError : ''}`} role={error ? 'alert' : undefined}>
          {error || blocker || 'All fields are placed. Ready to save.'}
        </p>
        <div className={styles.footActions}>
          {editingStatus === 'published' ? (
            <button type="button" className={adminStyles.secondaryBtn} onClick={requestClose} disabled={Boolean(saving)}>
              Cancel
            </button>
          ) : (
            <button
              type="button"
              className={adminStyles.secondaryBtn}
              onClick={() => save('draft')}
              disabled={Boolean(saving) || !imageSrc}
            >
              {saving === 'draft' ? 'Saving…' : 'Save and draft'}
            </button>
          )}
          <button
            type="button"
            className={adminStyles.primaryBtn}
            onClick={() => save('published')}
            disabled={Boolean(saving) || Boolean(blocker)}
          >
            {saving === 'published' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </footer>

      {picker && pickerModal}
    </div>
  );

  return createPortal(ui, document.body);
}
