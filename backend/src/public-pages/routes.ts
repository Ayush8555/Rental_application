import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Deps } from '../deps.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { sha256 } from '../lib/crypto.ts';
import { badRequest } from '../lib/errors.ts';
import { formatInr } from '../lib/money.ts';
import { isIndianMobile } from '../lib/phone.ts';
import { parse } from '../lib/validate.ts';
import { getSettings } from '../services/settings.ts';
import { startDeletion } from '../modules/me.ts';
import { firstName, imageUrl } from '../modules/serializers.ts';
import { priceLine } from '../modules/share-card.ts';
import { esc, page } from './html.ts';
import { privacyHtml, termsHtml, type LegalVars } from './legal.ts';

const here = dirname(fileURLToPath(import.meta.url));
const STATIC: Record<string, string> = { 'site.css': 'text/css; charset=utf-8', 'delete-account.js': 'text/javascript; charset=utf-8' };

// Pages share the strict CSP from app.ts; the delete page needs Firebase's
// web SDK and reCAPTCHA, so it gets its own, still narrow, policy.
const DELETE_PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.gstatic.com https://www.google.com https://apis.google.com https://challenges.cloudflare.com",
  "frame-src https://www.google.com https://*.firebaseapp.com https://challenges.cloudflare.com",
  "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com",
  "img-src 'self' data: https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

function html(reply: FastifyReply, body: string, cacheSec = 300) {
  return reply.header('Content-Type', 'text/html; charset=utf-8').header('Cache-Control', `public, max-age=${cacheSec}`).send(body);
}

async function legalVars(deps: Deps): Promise<LegalVars> {
  const s = await getSettings(deps.db);
  return {
    company: s.company.legalName,
    address: s.company.address,
    grievanceName: s.grievance.name,
    grievanceEmail: s.grievance.email,
    grievanceAddress: s.grievance.address,
    supportEmail: s.support.email,
    effectiveDate: s.legal.effectiveDate,
    privacyVersion: s.legal.privacyVersion,
    termsVersion: s.legal.termsVersion,
    deleteUrl: `${deps.env.PUBLIC_WEB_URL}/delete-account`,
  };
}

export default async function publicPages(app: FastifyInstance, deps: Deps) {
  const playUrl = deps.env.PLAY_STORE_URL;

  app.get('/static/:file', async (req, reply) => {
    const { file } = parse(z.object({ file: z.string().max(40) }).strict(), req.params);
    const type = STATIC[file];
    if (!type) return reply.status(404).send('Not found');
    const body = await readFile(join(here, 'static', file));
    return reply.header('Content-Type', type).header('Cache-Control', 'public, max-age=3600').send(body);
  });

  app.get('/', async (_req, reply) =>
    html(
      reply,
      page({
        title: 'RentNook — rent things from people near you',
        description: 'Find cameras, tools, furniture and more on rent near you. Put your own things on rent.',
        body: `<h1>Rent anything, near you</h1>
<p>Find a camera, a drill or a sofa for a few days from someone in your area, and talk to them on WhatsApp.
Have things lying unused? Put them on rent.</p>
<div class="row"><a class="btn btn-primary" href="${esc(playUrl)}">Get the app on Google Play</a></div>`,
      }),
      3600,
    ),
  );

  app.get('/privacy', async (_req, reply) => html(reply, page({ title: 'Privacy Policy — RentNook', body: privacyHtml(await legalVars(deps)) })));
  app.get('/terms', async (_req, reply) => html(reply, page({ title: 'Terms of Use — RentNook', body: termsHtml(await legalVars(deps)) })));

  // ------------------------------------------------------------ shared item page (P-02)

  app.get('/i/:shortId', async (req, reply) => {
    const { shortId } = parse(z.object({ shortId: z.string().max(20) }).strict(), req.params);
    const l = /^[A-Z0-9]{10}$/.test(shortId)
      ? await deps.db.listing.findUnique({
          where: { shortId },
          include: { area: true, city: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 }, user: { select: { name: true, status: true } } },
        })
      : null;
    if (!l || l.status !== 'LIVE' || !l.city.isOpen || l.user.status !== 'ACTIVE') {
      return html(
        reply.status(404),
        page({ title: 'No longer available — RentNook', noindex: true, body: `<h1>This item is no longer available</h1><p>It may have been rented out or removed. Have a look at what else is on rent near you.</p><div class="row"><a class="btn btn-primary" href="${esc(playUrl)}">Open RentNook</a></div>` }),
        60,
      );
    }
    const photo = l.images[0] ? await imageUrl(deps.storage, l.images[0].storageKey) : null;
    const extra = [
      l.rentDayPaise ? `${formatInr(l.rentDayPaise)} / day` : null,
      l.rentWeekPaise ? `${formatInr(l.rentWeekPaise)} / week` : null,
      l.rentMonthPaise ? `${formatInr(l.rentMonthPaise)} / month` : null,
    ].filter(Boolean);
    const url = `${deps.env.PUBLIC_WEB_URL}/i/${l.shortId}`;
    return html(
      reply,
      page({
        title: `${l.title} on rent in ${l.area.name} — RentNook`,
        description: `${priceLine(l)} · ${l.area.name}, ${l.city.name}`,
        image: photo,
        url,
        body: `${photo ? `<img class="photo" src="${esc(photo)}" alt="${esc(l.title)}">` : ''}
<h1>${esc(l.title)}</h1>
<div class="price">${esc(extra.join(' · '))}</div>
${l.depositPaise ? `<p class="muted">Deposit ${esc(formatInr(l.depositPaise))}</p>` : ''}
<p class="muted">${esc(l.area.name)}, ${esc(l.city.name)} · listed by ${esc(firstName(l.user.name))}</p>
<div class="row">
  <a class="btn btn-primary" href="${esc(url)}">Open in RentNook</a>
  <a class="btn btn-secondary" href="${esc(playUrl)}">Get it on Google Play</a>
</div>`,
      }),
      120,
    );
  });

  // ------------------------------------------------------------ shop page (A-32, public half)

  app.get('/s/:shortId', async (req, reply) => {
    const { shortId } = parse(z.object({ shortId: z.string().max(20) }).strict(), req.params);
    const shop = /^[A-Z0-9]{10}$/.test(shortId) ? await deps.db.shopProfile.findUnique({ where: { shortId }, include: { area: { include: { city: true } } } }) : null;
    const { shopIsActive } = await import('../modules/shops.ts');
    if (!shop || !(await shopIsActive(deps, shop.userId))) {
      return html(reply.status(404), page({ title: 'Shop not found — RentNook', noindex: true, body: '<h1>This shop page is not available</h1>' }), 60);
    }
    const items = await deps.db.listing.findMany({
      where: { userId: shop.userId, status: 'LIVE', city: { isOpen: true } },
      orderBy: { publishedAt: 'desc' },
      take: 40,
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    const cards = await Promise.all(
      items.map(async (l) => {
        const img = l.images[0] ? await imageUrl(deps.storage, l.images[0].storageKey) : null;
        return `<a class="card tile" href="/i/${esc(l.shortId)}">${img ? `<img class="photo" src="${esc(img)}" alt="">` : ''}<div class="title">${esc(l.title)}</div><div class="muted">${esc(priceLine(l))}</div></a>`;
      }),
    );
    const logo = shop.logoKey ? await imageUrl(deps.storage, shop.logoKey) : null;
    return html(
      reply,
      page({
        title: `${shop.shopName} — RentNook`,
        description: `${shop.shopName} in ${shop.area.name}, ${shop.area.city.name}. ${items.length} items on rent.`,
        image: logo,
        body: `<div class="card">${logo ? `<img class="logo" src="${esc(logo)}" alt="" width="64" height="64">` : ''}
<h1>${esc(shop.shopName)}</h1>
<p class="muted">${esc(shop.area.name)}, ${esc(shop.area.city.name)} · ${esc(shop.timings)}</p>
<p>${esc(shop.about)}</p></div>
<div class="grid">${cards.join('')}</div>
<div class="row"><a class="btn btn-primary" href="${esc(playUrl)}">See all in the app</a></div>`,
      }),
      120,
    );
  });

  // Referral links go to Play with the code, so the app can prefill it.
  app.get('/r/:code', async (req, reply) => {
    const { code } = parse(z.object({ code: z.string().regex(/^[A-Za-z0-9]{5,10}$/) }).strict(), req.params);
    const target = new URL(playUrl);
    target.searchParams.set('referrer', `ref=${code.toUpperCase()}`);
    return reply.redirect(target.toString(), 302);
  });

  // ------------------------------------------------------------ Android App Links

  app.get('/.well-known/assetlinks.json', async (_req, reply) => {
    const fingerprints = deps.env.ANDROID_CERT_SHA256.split(',').map((s) => s.trim()).filter(Boolean);
    return reply.header('Cache-Control', 'public, max-age=3600').send([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: { namespace: 'android_app', package_name: deps.env.ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
      },
    ]);
  });

  // ------------------------------------------------------------ delete account on the web (P-03)

  app.get('/delete-account', async (_req, reply) => {
    const firebase = deps.env.AUTH_PROVIDER === 'firebase';
    const cfg = {
      mode: firebase ? 'firebase' : 'dev',
      apiKey: deps.env.FIREBASE_WEB_API_KEY ?? '',
      authDomain: deps.env.FIREBASE_WEB_AUTH_DOMAIN ?? '',
      projectId: deps.env.FIREBASE_PROJECT_ID ?? '',
    };
    reply.header('Content-Security-Policy', DELETE_PAGE_CSP);
    return html(
      reply,
      page({
        title: 'Delete your RentNook account',
        noindex: true,
        scripts: firebase
          ? ['https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js', '/static/delete-account.js']
          : ['/static/delete-account.js'],
        body: `<h1>Delete your RentNook account</h1>
<p>You can also do this in the app: Profile → Delete my account.</p>
<div class="card">
<h3>What gets deleted</h3>
<ul class="plain"><li>Your profile (name, number, city)</li><li>All your items and their photos (hidden right away)</li><li>Saved items, requests, notifications, shop page and ID photo</li></ul>
<h3>What we keep</h3>
<ul class="plain"><li>Payment records required for tax, without your name or number</li><li>Security logs for up to 1 year</li></ul>
<p class="muted">Deletion finishes within 7 days. Any running plan ends and is not refunded.</p>
</div>
<div class="card" id="del" data-config="${esc(JSON.stringify(cfg))}">
  <div id="step-phone">
    <label for="phone">Mobile number</label>
    <input id="phone" inputmode="numeric" autocomplete="tel-national" maxlength="10" placeholder="10-digit number">
    <div class="err" id="phone-err"></div>
    <div id="recaptcha"></div>
    <div class="row"><button class="btn btn-primary" id="send">Send OTP</button></div>
  </div>
  <div id="step-otp" class="hidden">
    <label for="otp">6-digit code</label>
    <input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="6">
    <label for="reason">Reason (optional)</label>
    <textarea id="reason" maxlength="300" rows="2"></textarea>
    <div class="err" id="otp-err"></div>
    <div class="row"><button class="btn btn-danger" id="confirm">Delete my account</button></div>
  </div>
  <div id="step-done" class="hidden ok"></div>
</div>`,
      }),
      0,
    );
  });

  app.post('/delete-account/request', async (req) => {
    await enforceLimit(deps, 'web-delete-ip', req.ip, 5, 3600, 'Too many tries. Please wait an hour.');
    const body = parse(z.object({ idToken: z.string().min(10).max(4096), reason: z.string().trim().max(300).optional() }).strict(), req.body);
    const verified = await deps.phoneAuth.verifyIdToken(body.idToken);
    if (!verified || !isIndianMobile(verified.phone)) throw badRequest('We could not verify the code', 'BAD_ID_TOKEN');
    await enforceLimit(deps, 'web-delete-phone', sha256(verified.phone), 3, 24 * 3600, 'Too many tries for this number today.');
    const user = await deps.db.user.findUnique({ where: { phone: verified.phone } });
    if (user && user.status !== 'DELETED') await startDeletion(deps, user.id, 'web', body.reason);
    // Same answer either way: the page never confirms whether a number has an account.
    return { ok: true, message: 'If an account exists for this number, it is now being deleted. This finishes within 7 days.' };
  });
}
