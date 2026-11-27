# Decisions

Short record of choices that are not obvious from the plan.

**2026-11-26 — Staff accounts are a separate `Admin` table.**
The plan's data model has `role` on `User`. We keep app users and staff apart so a stolen phone
OTP can never become admin access, and admin login never touches Firebase.

**2026-11-26 — `Upload` table added.** Every signed upload belongs to the user who asked for it.
A client cannot attach another person's file to a listing, payment or ID check.

**2026-11-26 — `ContactEvent` and `UtrAttempt` tables added.** ContactEvent gives the 30-owners-a-day
limit and the lister's chat count. UtrAttempt keeps every UTR ever submitted, so a rejected UTR
can't be recycled by someone else.

**2026-11-26 — Closing a city does not change listing rows.** All public queries filter on
`City.isOpen`, so items disappear and come back exactly as they were. Plan days are paused.

**2026-11-26 — Images are re-encoded inside the `/uploads/:id/complete` request**, not in a
separate worker. Sharp handles a 5 MB photo in well under a second; the request stays simple and
the app gets an immediate answer. Move to BullMQ if this ever shows in latency.

**2026-11-26 — Search pages use offset cursors capped at 2,000.** Simple, fine at our size,
and the cap limits how deep a scraper can walk.

**2026-11-26 — One boost credit = one boost of the chosen length.** The plan does not fix the
length; admins set boost options in Settings.

**2026-11-26 — Referral reward when the referrer has no active plan** goes into
`User.rewardDaysBank` and is added to their next plan.

**2026-11-26 — Prisma 7, TypeScript 6.** TypeScript 7 is out but typescript-eslint does not
support it yet. Prisma "latest" on npm is an RC; we pinned the stable 7.x.

**2026-11-27 — Phosphor icons bundled as a font with our own constants.** `phosphor_flutter`
extends `IconData`, which Flutter 3.50 made final. Same icons, same font, no package.

**2026-11-27 — Firebase config comes from `--dart-define`**, not `google-services.json`.
The app builds without Firebase in dev (backend dev auth), and a release build without the values
refuses to start.

**2026-11-27 — CAPTCHA is Cloudflare Turnstile.** Free, no tracking cookies, works without a
Google account. Required on production by config.
