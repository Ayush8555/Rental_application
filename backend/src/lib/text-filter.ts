// Keeps contact details out of listing text. People try to dodge the
// "contact through the app" flow by writing numbers in creative ways, so the
// patterns are broad on purpose. Input is length-limited before it gets here
// (max 1,000 chars), and none of these patterns backtrack badly.

const PATTERNS: Array<[RegExp, string]> = [
  // 10-digit mobiles with optional +91 / 0 and separators: 98765 43210, 98-7654-3210
  [/(?:\+?91[\s.-]?|0)?[6-9](?:[\s.-]?\d){9}/g, '[number removed]'],
  // links
  [/\bhttps?:\/\/\S+/gi, '[link removed]'],
  [/\bwww\.\S+/gi, '[link removed]'],
  [/\b[a-z0-9-]{2,}\.(?:com|in|net|org|io|co|me|ly|xyz|app|link)\b\S*/gi, '[link removed]'],
  // emails
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email removed]'],
];

const HTML_TAG = /<\/?[a-z][^>]{0,200}>/gi;

export interface CleanResult {
  text: string;
  removed: boolean;
}

export function stripHtml(input: string): string {
  return input.replace(HTML_TAG, '').replace(/[<>]/g, '');
}

export function cleanListingText(input: string): CleanResult {
  let text = stripHtml(input).replace(/\s+\n/g, '\n').trim();
  let removed = false;
  for (const [re, replacement] of PATTERNS) {
    const next = text.replace(re, replacement);
    if (next !== text) removed = true;
    text = next;
  }
  return { text, removed };
}

// Words that show up again and again in rental scams. Matching only flags the
// listing for review; it never blocks it outright.
const SCAM_WORDS = [
  'advance payment',
  'pay advance',
  'advance pay',
  'token amount',
  'booking amount',
  'send otp',
  'share otp',
  'gift card',
  'paytm first',
  'pehle payment',
  'advance dena',
  'courier charge',
  'army officer',
  'cod not available',
];

export function scamHits(text: string): string[] {
  const lower = text.toLowerCase();
  return SCAM_WORDS.filter((w) => lower.includes(w));
}
