export function msToSeconds(ms: number): number {
  return Math.ceil(ms / 1000);
}

export function getTimeAgo(
  dateString: string | Date,
  locale: string = 'en',
): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  let interval = seconds / 31536000;
  if (interval > 1) {
    return rtf.format(-Math.floor(interval), 'year');
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    return rtf.format(-Math.floor(interval), 'month');
  }
  interval = seconds / 86400;
  if (interval > 1) {
    return rtf.format(-Math.floor(interval), 'day');
  }
  interval = seconds / 3600;
  if (interval > 1) {
    return rtf.format(-Math.floor(interval), 'hour');
  }
  interval = seconds / 60;
  if (interval > 1) {
    return rtf.format(-Math.floor(interval), 'minute');
  }
  return rtf.format(-Math.floor(seconds), 'second');
}
