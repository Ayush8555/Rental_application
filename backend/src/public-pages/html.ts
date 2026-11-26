// Tiny HTML helpers for the public pages. Every dynamic value goes through
// esc(); there is no "raw" helper on purpose.

export const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]!);

export interface PageOpts {
  title: string;
  description?: string;
  body: string; // already-escaped HTML built in this folder
  image?: string | null;
  url?: string;
  scripts?: string[];
  noindex?: boolean;
}

export function page(o: PageOpts) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
${o.description ? `<meta name="description" content="${esc(o.description)}">` : ''}
<meta property="og:title" content="${esc(o.title)}">
${o.description ? `<meta property="og:description" content="${esc(o.description)}">` : ''}
${o.image ? `<meta property="og:image" content="${esc(o.image)}">` : ''}
${o.url ? `<meta property="og:url" content="${esc(o.url)}">` : ''}
<meta property="og:site_name" content="RentNook">
${o.noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="stylesheet" href="/static/site.css">
</head>
<body>
<header class="top"><a class="brand" href="/">RentNook</a></header>
<main class="wrap">
${o.body}
</main>
<footer class="foot">
  <a href="/privacy">Privacy Policy</a><a href="/terms">Terms</a><a href="/delete-account">Delete account</a>
</footer>
${(o.scripts ?? []).map((s) => `<script src="${esc(s)}" defer></script>`).join('\n')}
</body>
</html>`;
}
