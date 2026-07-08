export function convertDecimalMonthsToMonthsDays(duration: number): string {
  if (duration === null || duration === undefined || isNaN(duration) || duration <= 0) {
    return '0 Days';
  }
  const months = Math.floor(duration);
  const daysDecimal = duration - months;
  const days = Math.round(daysDecimal * 30);
  
  // Adjust if days round up to 30
  let finalMonths = months;
  let finalDays = days;
  if (finalDays >= 30) {
    finalMonths += 1;
    finalDays -= 30;
  }
  
  const parts = [];
  if (finalMonths > 0) {
    parts.push(`${finalMonths} Month${finalMonths === 1 ? '' : 's'}`);
  }
  if (finalDays > 0) {
    parts.push(`${finalDays} Day${finalDays === 1 ? '' : 's'}`);
  }
  
  return parts.length > 0 ? parts.join(' ') : '0 Days';
}

export function getFormattedDuration(fromDateStr: any, toDateStr: any, fallbackDuration?: number | string): string {
  if (!fromDateStr || !toDateStr) {
    if (fallbackDuration !== undefined && fallbackDuration !== null && fallbackDuration !== '') {
      const num = Number(fallbackDuration);
      if (!isNaN(num)) {
        return convertDecimalMonthsToMonthsDays(num);
      }
      return String(fallbackDuration);
    }
    return '';
  }

  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);

  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    if (fallbackDuration !== undefined && fallbackDuration !== null && fallbackDuration !== '') {
      const num = Number(fallbackDuration);
      if (!isNaN(num)) {
        return convertDecimalMonthsToMonthsDays(num);
      }
      return String(fallbackDuration);
    }
    return '0 Days';
  }

  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    const daysInPrevMonth = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
    days += daysInPrevMonth;
  }
  months = Math.max(0, months);
  days = Math.max(0, days);

  const parts = [];
  if (months > 0) {
    parts.push(`${months} Month${months === 1 ? '' : 's'}`);
  }
  if (days > 0) {
    parts.push(`${days} Day${days === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(' ') : '0 Days';
}

