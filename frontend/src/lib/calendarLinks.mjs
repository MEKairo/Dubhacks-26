export function parseCalendarLink(input) {
  const invalid = () => new Error('Paste a Google Calendar share link or Calendar ID.');
  if (typeof input !== 'string' || !input.trim() || input.length > 4096) throw invalid();
  const text = input.trim();
  let id = text;
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    let url;
    try { url = new URL(text); } catch { throw invalid(); }
    if (url.protocol !== 'https:' || url.username || url.password ||
        !['calendar.google.com', 'www.google.com'].includes(url.hostname) ||
        !url.pathname.startsWith('/calendar') || /\.ics(?:$|\/)/i.test(url.pathname)) {
      throw new Error('Use a Google Calendar browser/share link, not an iCal or secret link.');
    }
    if (url.searchParams.has('src')) id = url.searchParams.get('src');
    else if (url.searchParams.has('cid')) {
      try {
        const encoded = url.searchParams.get('cid').replace(/-/g, '+').replace(/_/g, '/').replace(/ /g, '+');
        const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
        id = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch { throw invalid(); }
    } else throw invalid();
  }
  if (id !== 'primary' && (!/^[^\s/?#]+@[^\s/?#]+$/.test(id) || id.length > 1024)) throw invalid();
  return id;
}
