export function money(cents: number, locale: 'km' | 'en' = 'en'): string {
  const value = cents / 100;
  const formatted = value.toLocaleString(locale === 'km' ? 'en-US' : 'en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `$${formatted}`;
}

export function thousands(value: number): string {
  return value.toLocaleString('en-US');
}

export function shortDate(iso: string, locale: 'km' | 'en' = 'en'): string {
  const date = new Date(iso);
  return date.toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function relativeTime(iso: string, locale: 'km' | 'en' = 'en'): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  let rtf: Intl.RelativeTimeFormat | null = null;
  try {
    rtf = new Intl.RelativeTimeFormat(locale === 'km' ? 'km' : 'en', { numeric: 'auto' });
  } catch {
    rtf = null;
  }
  const ago = (value: number, unit: Intl.RelativeTimeFormatUnit) =>
    rtf ? rtf.format(-value, unit) : `${value} ${unit}${value === 1 ? '' : 's'} ago`;

  if (Math.abs(minutes) < 60) return ago(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return ago(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return ago(days, 'day');
  return shortDate(iso, locale);
}

export function weekday(dateIso: string, locale: 'km' | 'en' = 'en'): string {
  return new Date(dateIso).toLocaleDateString(locale === 'km' ? 'km-KH' : 'en-GB', { weekday: 'short' });
}

/** Minimal, safe markdown → HTML for assistant messages (bold, code, bullets, links). */
export function renderMarkdown(text: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = escape(text).split('\n');
  const html: string[] = [];
  let inList = false;

  for (const rawLine of lines) {
    const line = rawLine
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code>$1</code>');

    if (/^\s*[•\-*]\s+/.test(line)) {
      if (!inList) {
        html.push('<ul class="my-2 space-y-1.5 pl-1">');
        inList = true;
      }
      html.push(`<li class="flex gap-2"><span class="text-brand-300">•</span><span>${line.replace(/^\s*[•\-*]\s+/, '')}</span></li>`);
      continue;
    }
    if (inList) {
      html.push('</ul>');
      inList = false;
    }
    if (!line.trim()) {
      html.push('<div class="h-2"></div>');
      continue;
    }
    html.push(`<p class="leading-relaxed">${line}</p>`);
  }
  if (inList) html.push('</ul>');
  return html.join('');
}
