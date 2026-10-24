/**
 * Parse the official HASiL e-Invoice FAQ index to find its downloadable FAQ PDFs.
 * Only HTTPS PDF links hosted on hasil.gov.my are accepted; callers must still
 * validate the final URL after redirects before downloading the document.
 */
export interface OfficialFaqPdfLink {
  url: string;
  title: string;
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[\t\r\n ]+/g, ' ')
    .trim();
}

function isOfficialFaqPdfUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && (hostname === 'hasil.gov.my' || hostname.endsWith('.hasil.gov.my'))
      && /\.pdf(?:$|[?#])/i.test(pathname);
  } catch {
    return false;
  }
}

function latestHeading(htmlBeforeLink: string): string {
  const matches = htmlBeforeLink.match(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]\s*>/gi) || [];
  return matches.length ? decodeHtmlText(matches[matches.length - 1]) : '';
}

function usefulTitle(label: string, heading: string, url: string): string {
  const normalizedLabel = label.toLowerCase().replace(/\s+/g, ' ').trim();
  const genericLabels = new Set(['muat turun', 'download', 'klik untuk muat turun', 'view', 'lihat', 'pdf']);
  if (label && !genericLabels.has(normalizedLabel)) return label;
  if (heading) return heading;
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() || 'Official FAQ PDF';
    return slug.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  } catch {
    return 'Official FAQ PDF';
  }
}

export function extractOfficialFaqPdfLinks(html: string, listingUrl: string, maxLinks = 24): OfficialFaqPdfLink[] {
  if (!/^https:\/\/(?:www\.)?hasil\.gov\.my\//i.test(listingUrl)) return [];

  const links: OfficialFaqPdfLink[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html)) !== null) {
    const rawHref = (match[2] || match[3] || match[4] || '')
      .replace(/&amp;/gi, '&')
      .replace(/&#x2f;/gi, '/')
      .replace(/&#47;/gi, '/')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'");
    if (!rawHref || /^(?:#|mailto:|javascript:|data:)/i.test(rawHref)) continue;

    let resolved: URL;
    try { resolved = new URL(rawHref, listingUrl); } catch { continue; }
    const url = resolved.toString();
    if (!isOfficialFaqPdfUrl(url) || seen.has(url)) continue;

    seen.add(url);
    const label = decodeHtmlText(match[5] || '');
    const heading = latestHeading(html.slice(0, match.index));
    links.push({ url, title: usefulTitle(label, heading, url) });
    if (links.length >= Math.max(1, Math.min(maxLinks, 40))) break;
  }

  return links;
}
