/** Send dates for monthly posters (download + send are the same day). */

import { getActiveFestival, getGeneralPosters } from './posterCatalog';

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function formatDay(year, monthIndex, day) {
  return new Date(year, monthIndex, day).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sendDayForIndex(index, count, totalDays) {
  return Math.min(
    totalDays,
    Math.max(1, Math.round(((index + 0.5) / count) * totalDays))
  );
}

/**
 * Single send date for a poster in the current month.
 * mode: 'festival' | 'general'
 * generalIndex: 0-based index within general posters (or pack index)
 */
export function getPosterTiming(options = {}) {
  const date = options.date || new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const totalDays = daysInMonth(year, month);
  const festival = getActiveFestival(date);

  if (options.mode === 'festival' && festival) {
    const sendDay = sendDayForIndex(0, 10, totalDays);
    return {
      label: festival.festivalName || 'Festival',
      sendDay,
      sendLabel: formatDay(year, month, sendDay),
      isFestival: true,
    };
  }

  const general = getGeneralPosters().slice(0, 10);
  const gIndex = Math.max(0, Math.min(general.length - 1, options.generalIndex || 0));
  const sendDay = sendDayForIndex(gIndex, general.length, totalDays);

  return {
    label: `Poster-${gIndex + 1}`,
    sendDay,
    sendLabel: formatDay(year, month, sendDay),
    isFestival: false,
  };
}

/** Send date for an arbitrary index in a list of N posters (e.g. saved doctor posters). */
export function getSendDateForIndex(index, total = 10, date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const totalDays = daysInMonth(year, month);
  const count = Math.max(1, total);
  const safeIndex = Math.max(0, Math.min(count - 1, index));
  const sendDay = sendDayForIndex(safeIndex, count, totalDays);
  return formatDay(year, month, sendDay);
}
