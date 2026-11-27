# RentNook — Build, security and launch plan (v2.0, 23 Nov 2026)

Text copy of the signed-off plan PDF, kept here so the plan and the code
live in one place. The PDF is the source of truth; tables lost their
borders in this copy. Confidential — company internal.

BUILD, SECURITY AND LAUNCH PLAN

RentNook
Product, security and launch plan
Every screen, every check — setup to Google Play

VERSION

2.0

DATE

23 November 2026

STATUS

For build

PREPARED BY

Vimal Tiwari

PREPARED FOR

Daman Singh

PLATFORMS

Android, iOS (later), Web admin

Confidential — prepared for the client's internal use. Product name is a working title.

## 1. How to use this document

This is the complete build plan for RentNook, from an empty laptop to a live app on Google
Play. It is written so that an AI coding agent (Claude Code) can follow it phase by phase,
and so that a human can check every step.

The three rules
• One phase at a time. The agent does not start the next phase until every check in the
current phase's Gate has passed.
• Build → check → fix → check again. If any test, scan or review fails, the agent fixes it and
runs all checks again, not only the failed one.
• Product and security together. Each phase has a 'screens to build' section: every app
screen (A-), admin screen (W-) and public web page (P-) with its layout, behaviour, checks, API,
security and 'done when'.
• Nothing new without approval. Only the features in this document are built. New ideas go
to the "Later" list (section 33).

The work loop for every phase

Read phase card

Make a plan

Build

Automatic tests

and CLAUDE.md

wait for OK

small steps

unit + API

Write report

Gate checks

UI review

Security review

then next phase

all must pass

section 10 checklist

section 7.4 prompt

If any box fails, go back to Build, fix, and repeat every check

Phases at a glance
Phase

Name

Main result

Approx. time

0

Setup

Accounts, repository, servers, design kit, rules for the
agent

3–4 days

1

Foundation

Secure backend, login, cities, categories, admin login

5–6 days

2

Listings and search

Add items, photos, search, item page, WhatsApp
connect

6–7 days

3

Plans, payments, admin

Admin-made plans (paid and free), UPI payments,
notifications, full admin panel

6–7 days

4

Play Store ready

Legal pages, account deletion, hardening, signed build,
closed testing live

3–4 days

5

Launch features

Already-agreed launch features, built while testing runs

8–10 days

6

Hardening and public
launch

Full security test, load test, production release

5–6 days

7

Run and maintain

Monitoring, backups, updates, handover

Ongoing

Phases 0–4 together produce an app that passes Google Play's checks for closed
testing. Phases 5 and 6 continue in parallel while testers use the app.

Words used in this plan
Word

Meaning

Agent

Claude Code, the AI that writes the code by following this plan

Gate

A list of checks that must all pass before moving to the next phase

Feature card

A small, clear piece of work with an ID, details and checks

Backend / API

The server program that stores data and answers the app

Staging

A copy of the live system used for testing, with fake data

Production

The real live system used by real people

Seeker / Lister

Person looking for items (free) / person giving items on rent (plan)

## 2. Project summary

RentNook: an India-wide app where people put unused things on rent, and others find
them nearby and talk on WhatsApp. Prepared by Vimal Tiwari for Daman Singh.
Part

What it does

Mobile app (Android first, iPhone
later)

Seekers search and contact owners free. Listers buy a plan and manage
their items.

Admin panel (website)

Daman Singh's team creates plans, checks payments, reviews items,
manages users and cities.

Backend (server)

Stores all data safely, applies every rule, sends notifications.

Public web pages

Privacy Policy, Terms, account deletion request page, item share links.

Scope locked for this plan
• Login with mobile OTP; guest browsing.
• Cities that admin can open or close.
• Categories managed by admin.
• Listings with photos, rent per day/week/month, deposit; search and filters; item page;
WhatsApp connect.
• Save, report, block.
• Plans created by admin (paid or free), UPI payment with UTR check, boosts.
• Notifications (app push + in-app list).
• Agreed launch features: free trial, refer a friend, share card, coupons, request an item,
near-me sorting, ID-verified badge, shop page, English + Hindi, demand insights.
• Admin panel for all of the above.
• Account deletion, legal pages, privacy controls.

Not in this plan (kept for later)
Anything not listed above, including in-app chat, payment gateway, ratings and reviews, booking
calendar, saved-search alerts, seeker website, delivery and insurance. See section 33.

## 3. Technology stack

Layer

Choice

Notes

Mobile app

Flutter (latest stable), Dart

Android target API 36; minimum Android 7.0 (API
24); 16 KB page-size compatible build

App libraries

Riverpod, Dio, go_router,
flutter_secure_storage, firebase_auth,
firebase_messaging,
firebase_app_check,
cached_network_image, image_picker,
intl, url_launcher

Only well-known, maintained packages; versions
pinned

Backend

Node.js LTS, TypeScript (strict), Fastify

One code style, linted, tested

Validation

Zod schemas on every request

Unknown fields rejected

Database

PostgreSQL 16 + Prisma ORM

Money in paise (integers); UUID ids

Cache and jobs

Redis + BullMQ

Rate limits, OTP limits, scheduled jobs

Auth

Firebase Phone Auth (OTP) → backend
issues its own short tokens

App Check with Play Integrity

Push

Firebase Cloud Messaging

Free

Files

Private S3-compatible object storage +
signed URLs

Images re-encoded to WebP

Admin panel

React + TypeScript + Vite, TanStack
Query, a small own component kit

Cookie-based session, 2-step login

Public pages

Static pages served by the backend
(privacy, terms, delete account, share
links)

No heavy framework

Hosting

Linux cloud server in India + Docker
Compose + reverse proxy with
automatic HTTPS

Optional CDN / web firewall in front

Quality

Vitest, Supertest, Flutter tests,
Playwright (admin), k6 (load)

Run in CI

Security tools

Semgrep, Gitleaks, npm audit,
Dependabot, OWASP ZAP, MobSF

Run in CI and before releases

Monitoring

Sentry (app, admin, backend), uptime
monitor, server metrics

Alerts to Daman Singh and Vimal Tiwari

Version rules
• Use the latest stable versions on the day Phase 0 starts, then lock them (lockfiles committed).
• Upgrade dependencies once a month in a separate change, after tests pass.
• Never use a package with very few users or no updates for a year without approval.

## 4. Accounts and ownership

Every account is created in Daman Singh's (company) name, with company email and
company payment card. Vimal Tiwari gets team access only.
#

Account

Owner

Developer access

Phase

1

Company Google account (e.g.
tech@company)

Daman Singh

—

0

2

Google Play Console (organization account
with D-U-N-S, recommended)

Daman Singh

Admin user

0

3

Firebase / Google Cloud project (staging +
production)

Daman Singh

Editor

0

4

Cloud server (staging + production)

Daman Singh

SSH key access

0

5

Object storage for photos

Daman Singh

Scoped keys

0

6

Domain name + DNS

Daman Singh

DNS edit

0

7

GitHub organization (private repository)

Daman Singh

Admin

0

8

Sentry (error tracking)

Daman Singh

Member

0

9

Company email for support and grievance
officer

Daman Singh

—

0

10

Password manager (shared vault)

Daman Singh

Member

0

11

Company UPI ID and bank account (for plan
payments)

Daman Singh

None

3

12

Apple Developer (only when iPhone app is
started)

Daman Singh

Admin

Later

Rules
• Turn on 2-step login on every account above.
• Passwords live only in the password manager, never in chat, email or code.
• Play App Signing is enabled; the upload key is stored in the password manager with a backup.
• Billing alerts are set on cloud and Firebase accounts so unexpected costs are noticed the same
day.

## 5. Repository and environments

Folder structure
rentnook/
CLAUDE.md
rules the agent must follow (section 7.1)
docs/
BUILD_PLAN.md
this plan (text copy)
PROGRESS.md
agent writes status after every phase
DECISIONS.md
every important decision with date
SECURITY_REVIEW.md
findings and fixes per phase
backend/
prisma/schema.prisma
src/{modules,plugins,lib,jobs,public-pages}
test/
admin/
React admin panel
app/
Flutter app
infra/
docker-compose, proxy config, backup scripts
.github/workflows/
CI pipelines

Three environments
Environment

Used for

Data

Who uses it

Local

Writing code on the laptop

Fake seed data

Developer, agent

Staging

Testing every change before release;
closed-test builds point here first

Fake data, separate
Firebase project

Team, testers

Production

Real users

Real data

Public

Each environment has its own database, storage bucket, Firebase project, secrets and admin
accounts. Production secrets are never copied to a laptop.

Branch and release rules
• main is always releasable and protected: no direct pushes, pull request + passing CI required.
• Each feature card = one branch = one pull request, named like feat/LIST-03-photo-upload.
• Every merge to main deploys to staging automatically. Production deploys are manual, with a
tag (v1.0.0).
• App version: major.minor.patch+build; build number increases on every Play upload.

## 6. Definition of done

A feature card is "done" only when all of these are true.
#

Check

D1

Code follows CLAUDE.md rules; lint and type checks pass with zero errors.

D2

Unit and API tests written for the feature; all tests pass; coverage of new backend code ≥ 80%.

D3

Every endpoint has an authorization test (another user gets 403/404) and a validation test (bad input
gets 400).

D4

Security review prompt (7.4) run on changed files; no Critical or High findings left open.

D5

Screens checked on a real low-end Android phone and one mid-range phone; no overflow, works with
large font.

D6

UI checklist (section 10) passes; screenshots saved in the pull request.

D7

Hindi strings added (when Hindi is turned on in Phase 5).

D8

No secrets, personal data or debug logs added; Gitleaks passes.

D9

PROGRESS.md updated with what was done and how it was tested.

Gate rules
A phase gate passes only if every item is ticked. If one fails, the agent fixes it and re-runs the
whole gate. After 3 failed attempts on the same item, the agent stops and writes the problem in
PROGRESS.md for Vimal Tiwari to decide.

## 7. Instructions for the AI agent

Copy these texts exactly. CLAUDE.md goes in the repository root; the prompts are pasted
into Claude Code at the start of each phase or task.

7.1 CLAUDE.md (repository rules)
# RentNook — rules for every task
Read docs/BUILD_PLAN.md (the phase you are in) and docs/PROGRESS.md before any work.
## Scope
- Build ONLY what the current phase card says. No extra features, screens or packages.
- If something is unclear, write the question in docs/PROGRESS.md and stop.
## Stack
Backend: Node LTS, TypeScript strict, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Zod.
Admin: React + TypeScript + Vite + TanStack Query. App: Flutter (Riverpod, Dio, go_router).
## Security rules (never break)
1. Validate body, params, query and headers with Zod. Reject unknown fields (strict).
2. Every route that reads or changes a record checks ownership or role on the server.
Write a test proving user A cannot read or change user B's data.

## 3. Responses use explicit output schemas (allow-list). Never return phone numbers,

exact location, tokens, hashes or internal flags unless the card says so.
4. Database access only through Prisma. No string-built SQL.

## 5. No secrets in code, logs, tests, screenshots or the Flutter app. Use env vars;

add new keys to .env.example with a dummy value.
6. Money is integer paise. Amounts are always computed on the server.
7. Every admin action writes an AuditLog row (who, what, before, after, ip).
8. Errors to clients: {error:{code,message}} only. No stack traces or SQL errors.
9. Every list endpoint is paginated (max 50) and every write endpoint is rate limited.
10. Use database transactions + unique constraints for money, plans, coupons, approvals.
11. Never log OTPs, tokens, full phone numbers (mask: 98XXXXXX10) or ID documents.
12. Do not add or upgrade a dependency without explaining why in the pull request.
## UI rules
Follow docs/BUILD_PLAN.md sections 8-10 (design system and human-feel rules).
Use only design tokens; no hard-coded colours, sizes or fonts in screens.
## Workflow
1. Plan: list files to change, data changes, endpoints, screens, tests. Wait for OK.
2. Build in small commits. 3. Run: lint, typecheck, tests, npm audit, gitleaks.
4. Run the security review (7.4) and UI review (7.5) on what changed.
5. Fix everything found, then re-run ALL checks. Repeat until clean.
6. Update docs/PROGRESS.md: done, how tested, open issues.

7.2 Phase start prompt
Read CLAUDE.md, docs/BUILD_PLAN.md section <PHASE SECTION> and its 'screens to build'
section, and docs/PROGRESS.md.
We are starting Phase <N>: <NAME>.

## 1. List every task card and screen card of this phase in order, with the files

you will touch. Build backend first, then admin screens, then app screens.
2. List the gate checks of this phase and how you will run each one.
3. Wait for my OK. Then build task by task. After each task run all tests.
4. At the end, run the full gate. If any check fails: fix, then run the whole gate again.
5. When everything passes, write the phase report in docs/PROGRESS.md and stop.
Do not start the next phase.

7.3 Fix-loop prompt (when a check fails)
The following check failed: <PASTE OUTPUT>.
1. Find the root cause (do not hide the error, do not skip or delete tests).
2. Fix it with the smallest safe change.
3. Add a test that would have caught it.
4. Re-run ALL checks of the current gate, not only this one.
5. Report: cause, fix, new test, full gate result.

7.4 Security review prompt
Act as an attacker and a senior security reviewer. Review <FILES / FEATURE / WHOLE REPO>.
Check against: OWASP API Security Top 10 (2023), OWASP Top 10 (2025),
OWASP Mobile Top 10 (2024) and MASVS, and BUILD_PLAN sections 15-22.
Look especially for: access to other users' data by changing ids (BOLA/IDOR),
fields the client should not set (mass assignment), missing rate limits,
phone-number scraping, UTR reuse, payment amount tampering, coupon/trial/referral abuse,
race conditions (double approve, double coupon use), XSS in the admin panel from
user text, CSRF, insecure uploads, secrets in code, sensitive data in logs or responses.
For each finding: severity, file:line, how it is exploited, fix.
Then fix all Critical and High findings, add a regression test for each,
re-run all tests, and append the results to docs/SECURITY_REVIEW.md.
Never claim the code is "100% secure"; list remaining risks.

7.5 UI review prompt
Take screenshots of every screen changed in this phase on a 360x800 and a 412x915
Android emulator, light theme, English and (from Phase 5) Hindi, normal and largest font.
Check each screenshot against BUILD_PLAN section 10 checklist. For every failed item,
fix the screen using only design tokens. Save before/after screenshots in docs/ui/
and list them in PROGRESS.md.

## 8. Design system

One small, consistent design system makes the app feel like a real company product. All
values are stored as tokens in code.

Colours
Token

Hex

Used for

primary

#0F766E

Main buttons, active tab, links

primary-dark

#115E59

Pressed state

primary-soft

#E6F4F2

Selected chips, info backgrounds

ink

#111827

Main text

ink-2

#4B5563

Secondary text (passes 4.5:1 contrast)

line

#E5E7EB

Borders, dividers

surface

#FFFFFF

Cards, sheets

background

#F5F6F4

Screen background

accent

#C2410C

Offers, boosts, sponsored labels

whatsapp

#15803D

Chat on WhatsApp button only

danger

#B91C1C

Errors, delete

warning

#B45309

Pending states

navy

#0B1F3A

Admin sidebar, headings in admin

Typography
Use

Font

Size / weight

Headings

Sora (Latin) with Noto Sans Devanagari fallback

22 / 18 / 16, weight 600–700

Body

Noto Sans + Noto Sans Devanagari (same family for
English and Hindi)

15 body, 13 secondary, 12
labels; weight 400/500

Numbers (prices)

Noto Sans, tabular figures

16–20, weight 700

Fonts are bundled inside the app (no download at run time). Text must respect the phone's
font-size setting up to 130% without breaking layouts.

Spacing, shape and elevation
Token

Value

Spacing scale

4, 8, 12, 16, 20, 24, 32 (8-point grid). Screen side padding 16.

Corner radius

8 for inputs and chips, 12 for cards and buttons, 20 for bottom sheets. Never fully round
big cards.

Borders vs shadows

Cards use a 1 px border (line). Shadows only on bottom sheets and floating buttons.

Touch targets

Minimum 48 × 48 dp on Android.

Icons

One outline icon set (Phosphor), 1.5–2 px stroke, 20/24 dp. No emoji as icons.

Images

Real photos uploaded by listers, shown 4:3 in lists and 1:1 thumbnails. Grey placeholder
with category icon while loading.

Token

Value

Motion

150–250 ms ease-out; no bouncing, no confetti, no auto-playing animation.

Core components (built once, reused everywhere)
Component

Notes

Button

Primary (filled), secondary (outline), text; loading and disabled states; full-width on forms

Input

Label above, helper text below, error text in danger colour, numeric keyboard for
numbers

Chip

Filters and categories; selected = primary-soft background + primary text

Item card (list)

Thumbnail left, title (2 lines max), area · distance, price, verified mark, save button

Item card (grid)

Photo top 4:3, title, price; used for Sponsored row only

Status pill

Live / Under review / Rented out / Hidden / Pending / Approved / Rejected — fixed colours

Bottom sheet

Safety tips, filters, confirm actions

Empty state

Short human sentence + one action button, small line illustration or category icon

Skeleton loader

Grey blocks in the shape of the real content; no spinners on lists

Toast / snackbar

Bottom, 3 seconds, one line, with Undo where possible

## 9. Making the UI feel human, not AI-generated

Users quickly notice when an app looks auto-generated. These rules keep RentNook
looking like a real Indian product built with care.

Signs that make an app look AI-generated (avoid all)
Avoid

Do this instead

Purple-blue gradients, glowing backgrounds, glass
blur effects

Flat brand colours: teal, navy, warm orange on soft
white

Emoji used as icons or in headings

One consistent outline icon set

Sparkle / magic-wand icons, "AI" vibes

Plain, purpose icons (camera, sofa, key)

Every card the same with big shadow and huge
rounded corners

Thin borders, 12 radius, shadows only on sheets

Everything centred, big hero text, lots of empty space

Left-aligned content, real information density like
popular Indian apps

Generic words: "Unlock", "Elevate", "Seamless",
"Effortless", "Discover the future"

Plain everyday words: "Find a camera near you", "Put
your drill on rent"

Stock 3D illustrations of people and blobs

Real item photos; simple line illustrations only in empty
states

Gradient text, neon colours

Solid ink colour text

Fake numbers ("10,000+ happy users") on day one

Only true numbers, or none

Lorem ipsum or obviously machine-written sample
listings

Realistic seed data written by a person, with Indian
names, areas and prices

Same layout copied for every screen

Each screen designed for its job (list, form, detail,
status)

Hindi text machine-translated

Hindi reviewed by a native speaker; short and natural
("Kiraye pe do")

Positive rules
• Write copy like a helpful shopkeeper: short, polite, specific. Use ₹ and Indian number format
(1,20,000).
• Show real context: area names, distance in km, "Member since 2026", "Replies in about 1
hour".
• Use one accent colour per screen at most. Teal for action, orange only for offers and boosts.
• Keep consistent alignment: all text starts at the 16 dp left edge.
• Every state is designed: loading, empty, error, offline, success.
• Icons, photos and text sizes follow the tokens in section 8 only.
• App icon and splash: simple logo on teal, no gradient, no 3D effect.

## 10. UI review checklist and process

Checklist (run on every screen)
#

Check

Pass when

U1

Only design tokens used

No raw hex colours or font sizes in screen code

U2

Nothing from the "avoid" list in section 9

Reviewer finds none

U3

Text contrast

Body text 4.5:1 or more; large text 3:1 or more

U4

Touch targets

48 dp or more

U5

Small phone (360 × 800)

No overflow, no cut text

U6

Largest system font

Still readable, nothing overlaps

U7

Hindi

No cut words; buttons still fit

U8

All states

Loading, empty, error, offline designed

U9

Copy

Plain words, no buzzwords, no spelling mistakes

U10

Screen reader

Every icon button has a label (TalkBack test)

U11

Consistency

Same component looks the same on every screen

U12

Speed feel

Skeletons appear within 100 ms; no layout jump when data
arrives

Human check (end of Phases 2, 3 and 5)
• Show screenshots to 3 people who were not involved (one aged 40+, one who mainly uses
Hindi).
• Ask: "Does this look like an app from a real company? Anything feel odd or robotic?"
• Anything mentioned by 2 or more people is fixed before the gate passes.
• Daman Singh approves the final look before Phase 4.

## 11. Data model

All tables use UUID ids, created/updated timestamps and soft-delete where noted. Money
is stored in paise.
Table

Fields

Key rules

User

id, phone (unique, E.164), name, cityId, role
(USER/ADMIN/SUPER_ADMIN), isLister, status
(ACTIVE/BLOCKED/DELETED), language, referralCode
(unique), referredById, idVerified, createdAt, lastSeenAt

Phone never returned in
public APIs

Session

id, userId, refreshTokenHash, deviceId, appVersion,
createdAt, lastUsedAt, revokedAt

Rotated on every refresh;
reuse revokes all

DeviceToken

userId, fcmToken, platform, updatedAt

Removed on logout

ConsentLog

userId, noticeVersion, acceptedAt, withdrawnAt, ip

Append only

City

id, name, nameHi, state, slug, isOpen, lat, lng, openedAt

Closing never deletes data

Area

id, cityId, name, lat, lng

CityWaitlist

cityId, userId, createdAt

Category

id, name, nameHi, icon, sortOrder, isActive, fieldsSchema
(JSON)

Plan

see section 12

Created by admin

Subscription

see section 12

Snapshot of plan at purchase

Payment

id, userId, purpose (PLAN/BOOST), refId, amountPaise, utr
(unique), screenshotKey, status, reviewedById, reviewedAt,
rejectReason, couponId

Section 13

Listing

id, userId, cityId, areaId, categoryId, title, description,
rentDayPaise, rentWeekPaise, rentMonthPaise, depositPaise,
condition, extra (JSON), status, approxLat, approxLng,
featuredUntil, viewCount, waClickCount, reportCount,
publishedAt

Status machine in section 14

ListingImage

id, listingId, storageKey, width, height, sortOrder, hash

Max 8 per listing

Favorite

userId, listingId

Unique pair

Block

blockerId, blockedId

Unique pair

Report

id, reporterId, listingId?, userId?, reason, note, status,
actionNote, handledById

One per reporter per target

ItemRequest

id, userId, cityId, categoryId, text, fromDate, toDate, status

Max 5 per day

Coupon

code (unique, upper case), type (PERCENT/FLAT), value,
validFrom, validTo, maxUses, usedCount, perUserLimit,
cityId?, planIds[]

Checked again at approval

CouponUse

couponId, userId, paymentId

Unique (couponId,
paymentId)

Referral

referrerId, refereeId (unique), rewardDays, status,
rewardedAt

Self-referral blocked

Notification

id, userId, type, title, body, data (JSON), readAt

ShopProfile

userId (unique), shopName, logoKey, areaId, timings, about

Confidential

Unique per user per city

Business plans only

Page 17

Table

Fields

Key rules

IdVerification

id, userId, docKey, status, reviewedById, decidedAt,
deleteAfter

Image deleted 30 days after
decision

SearchLog

cityId, query, categoryId, resultCount, createdAt

No user id stored

Setting

key, value (JSON), updatedById

UPI ID, payee name, support
contacts, limits

AuditLog

id, actorId, action, entity, entityId, before, after, ip,
userAgent, createdAt

Append only; no
update/delete permission

## 12. Subscription and plan engine

(admin-controlled)
All plans — paid, free, trial, business — are created and edited by admin from the admin
panel. Nothing about plans is fixed in the app.

12.1 Plan fields (Admin → Plans → New plan)
Field

Meaning

Example

Name (English) / Name
(Hindi)

Shown to users

Quarterly / Teen mahine

Type

PAID, FREE, TRIAL or BUSINESS

PAID

Price (₹)

0 allowed. Price 0 = free plan, no payment step

799

Duration (days)

How long the plan lasts after activation

90

Listing limit

Max live items; blank = unlimited

15

Boost credits per month

Free boosts included (0 for most plans)

0 (Business: 2)

Shop page

Allows a shop profile (yes/no)

No

Max times per user

How often one user can take this plan; 1 for trials and
free offers

Unlimited

Needs admin approval

For free plans: activate instantly or after admin
approval

Instant

Visibility

PUBLIC (shown to all), HIDDEN (only by direct assign or
coupon), ARCHIVED (no new sales)

PUBLIC

Available in cities

All cities or selected cities

All

Valid from / to

Optional sale window, e.g. Diwali offer

—

Badge text

Small label, e.g. "Popular", "Best value"

Popular

Sort order

Order on the Plans screen

2

Description points

Up to 4 short lines shown under the plan

Up to 15 items

12.2 How admin adds a FREE plan
• Admin → Plans → New plan → Type FREE (or TRIAL) → Price 0 is set automatically.
• Choose duration, listing limit, max times per user (usually 1), and whether it activates instantly
or needs approval.
• Choose visibility: PUBLIC shows it on the Plans screen for everyone; HIDDEN lets admin give it
only to selected users (e.g. first 50 shops).
• Save → the plan appears in the app immediately (the app always loads plans from the server).
• Users tap Activate free plan — no UPI screen. The server checks eligibility (limit per user,
city, dates) and creates the subscription.

12.3 Admin assigns a plan manually
Admin → Users → open user → Give plan → choose any plan (including hidden), start date,
reason. Used for partners, compensation or offline payments. Logged in the audit log with the
reason. Only Super admin can give paid plans for free.

12.4 Subscription states

PENDING

ACTIVE

EXPIRING

EXPIRED

waiting payment check

items live

reminders 7/3/1 days

items hidden

Rejected payments go to REJECTED; admin can CANCEL with a reason

Rule

Behaviour

Snapshot

When a subscription is created, the plan's price, days, limit and features are copied into it.
Later edits to the plan never change existing subscriptions.

Start time

Paid: when admin approves the payment. Free/trial: when user activates (or when admin
approves, if required).

Stacking

Buying while a plan is active queues the new plan to start when the current one ends (no
lost days). Upgrading to a bigger plan starts immediately and the remaining days are added
at the end (simple, no refunds).

Limit

If live items exceed the new plan's limit, the newest extra items move to Draft and the lister
is told which ones.

Expiry job

Runs every 15 minutes (server time IST). Idempotent: running twice changes nothing.

City closed

Days are [paused] while the lister's city is closed.

Delete a plan

Not allowed if anyone ever bought it — admin archives it instead.

Price change

Applies only to new purchases. Pending payments keep the old price.

12.5 Edge cases the agent must test
• Two approvals of the same payment at the same moment → only one subscription.
• User tries a free plan twice (two phones, reinstall) → refused after the first use.
• Admin archives a plan while a user is on the payment screen → payment still checks against
the stored price.
• Plan expires while the lister is editing an item → save succeeds as Draft with a message.
• Clock change or server restart → expiry job catches up without double reminders.

## 13. UPI payment verification engine

No payment gateway. Money goes directly to the company UPI ID; the admin confirms
each payment by matching the UTR with the bank statement.

Server creates

App opens UPI

User pays

User enters UTR

payment, amount

upi://pay link

in UPI app

+ screenshot

Plan / boost

Approve

Admin matches

Server checks

activated + push

in a transaction

bank statement

format, unique

Payment flow

Rules that stop payment fraud
Risk

Protection

User changes amount in
the app

Amount is computed on the server from plan + coupon and stored on the payment.
The UPI link is built from server values.

Fake or edited
screenshot

Screenshot is only supporting evidence. Admin must match the UTR and amount in
the real bank statement before approving.

Same UTR used twice

UTR column is unique in the database; duplicates are rejected with a clear message
and flagged to admin.

Typo UTR

Format check: exactly 12 digits. Admin can reject with reason "UTR not found"; user
can resubmit.

Double click on Approve

Approval runs in one database transaction with a row lock and a status check (only
PENDING → APPROVED).

Coupon reused

Coupon use is recorded in the same transaction; perUserLimit and maxUses
checked again.

Admin mistake or misuse

Only ADMIN role can approve; every action is in the audit log; daily report of
approvals to Super admin.

Too many pending
attempts

Max 3 pending payments per user; max 10 UTR submissions per day.

Screenshot leak

Stored in a private bucket; admin sees it through a 10-minute signed link; deleted
180 days after decision.

UPI link format
upi://pay?pa=<company UPI ID>&pn=<payee name>&am=<amount in rupees>&cu=INR&tn=RN-<short payment id>

The note (tn) carries a short payment reference so the admin can find the payment in the bank
statement quickly. Values come from server settings.

## 14. Business rules

Area

Rule

Accounts

One mobile number = one account. Users confirm they are 18+.

Guest

Can browse and search; cannot contact, save, report or list.

Listing states

DRAFT → (REVIEW if moderation on) → LIVE ⇄ RENTED_OUT; LIVE → HIDDEN (plan ended,
city closed, blocked, 3 reports); any → REMOVED by admin.

Listing content

Title 8–80 chars; description 20–1,000; at least one rent value; deposit optional; 1–8 photos;
no phone numbers, links or emails in text (auto-removed and warned).

Live limit

Live items ≤ plan limit. Extra items stay Draft.

Contact

Logged-in users only; max [30] different owners per day; blocked users cannot contact each
other.

Reports

3 reports from different users auto-hide the item until admin review.

Banned items

Weapons, drugs, medicines, alcohol, adult items, animals, fake/stolen goods, government
ID documents, anything illegal.

Cities

Closing hides items, blocks new items and pauses plan days; reopening restores everything
and notifies the waitlist.

Boost

Max [10] sponsored items per city at one time; extra boosts wait in a queue.

Requests

Max 5 per day per user; auto-close after the "to" date.

Referral

Reward after the referee's first approved paid payment; no self-referral; max [5] rewards
per month.

Refunds

Not after approval, unless Super admin decides (written in Terms).

Deletion

Account deleted within 7 days of request; listings removed; payments kept as required by
law in anonymised form.

## 15. Security: threat model

Before building defences we list what is valuable, who might attack it, and from where.
Every later security section maps back to this page.

Bots and scrapers

Mobile app

OTP abuse, number scraping

tampering, stored data

What we protect
phone numbers, payments,
admin access, user trust

Fraudsters

Backend API

fake items, fake payments

auth, data access, limits

Server + database
infrastructure, backups

Hackers

Admin panel

API, admin, server attacks

XSS, CSRF, stolen login

Attackers, attack surfaces and what we protect

What is valuable
Asset

Why it matters

Main protection

Users' phone numbers

Can be sold or used for spam and
scams

Never in lists; revealed one at a time with
daily limits

Payments and plans

Direct money loss

Server-side amounts, unique UTR, admin
approval in a transaction

Admin access

Full control of the business

2-step login, roles, short sessions, audit log

User trust (no fake items
or scams)

The marketplace dies without trust

Moderation, reports, verified badge, safety
tips

ID documents

Very sensitive personal data

Separate private storage, Super admin
only, deleted after 30 days

Server and database

Everything else depends on them

Hardened server, private database,
encrypted backups

Firebase / SMS budget

Attackers can burn money with fake
OTPs

SMS region policy, App Check, limits

Security principles
• Never trust the app. Anything from the phone can be changed by an attacker; the server
checks everything again.
• Deny by default. A route is private unless the card says it is public.
• Least privilege. Every person, key and service gets only the access it needs.
• Defence in depth. Several layers (app, gateway, server, database) so one mistake is not a
breach.
• Log, alert, recover. Assume something will go wrong; detect it fast and restore from backup.

## 16. Mobile app: loopholes and fixes

Mapped to the OWASP Mobile Top 10 (2024): improper credential usage, supply chain,
authentication/authorization, input/output validation, communication, privacy controls,
binary protections, security misconfiguration, data storage and cryptography.
Attack / loophole

How it happens

How we stop it

M1 Credentials inside the
app

API keys or secrets placed in Dart code
or assets can be extracted from the
APK in minutes

No secrets in the app at all. Firebase
config is public by design but its API key
is restricted to the app's package name
and SHA-256 certificate in Google Cloud.

M2 Bad or fake packages

A malicious or abandoned Flutter
package steals data

Only well-known packages; versions
locked; monthly review; MobSF scan of
every release

M3 Weak login / missing
checks

App hides buttons but the server still
accepts the action

All permission checks on the server; app
only reflects server answers

M4 Bad input / output

Deep links or text with scripts crash or
mislead the app

Validate deep-link parameters; no
WebView for user content; text shown as
plain text

M5 Insecure
communication

Attacker on public Wi-Fi reads or
changes traffic

HTTPS only; cleartext traffic disabled in
network security config; HSTS on server;
optional certificate pinning with backup
pins

M6 Privacy leaks

Logs, screenshots or analytics expose
phone numbers

No personal data in logs/analytics; mask
numbers; FLAG_SECURE on payment
proof screen; minimum permissions

M7 Reverse engineering

Attacker reads app logic and endpoints

Release build with --obfuscate and
--split-debug-info; R8 shrinking; no
debug code; logic that matters stays on
the server

M8 Misconfiguration

debuggable=true, allowBackup=true,
exported activities

Release config: debuggable false,
allowBackup false, exported only for
launcher and verified App Links

M9 Insecure data storage

Tokens in SharedPreferences, cached
personal data on SD card

Tokens in flutter_secure_storage
(Android Keystore); cache only public
listing data; clear all on logout

M10 Weak cryptography

Home-made encryption

Use only platform crypto via secure
storage; no custom crypto

Tampered / fake app

Modified APK or bot scripts call the API
directly

Firebase App Check with Play Integrity
on login and sensitive endpoints; server
rejects requests without a valid token

Deep link hijacking

Another app claims rentnook links

Android App Links with assetlinks.json
verification; only https links

Intent / clipboard leaks

Other apps read copied UTR or shared
data

Do not auto-copy sensitive data; share
sheet only for public content

Rooted phones

Easier tampering

Play Integrity verdict logged; high-risk
actions (payments) require a passing
device verdict; no hard block for normal
browsing

## 17. Backend API: loopholes and fixes

Mapped to the OWASP API Security Top 10 (2023). These are the most common ways real
apps get hacked.
Attack / loophole

How it happens

How we stop it

API1 Broken object level
authorization (IDOR)

User changes /listings/123 to
/listings/124 and edits someone else's
item

Every query filters by owner (where: {id,
userId}) or checks role; automatic test
per endpoint with two users

API2 Broken
authentication

Stolen or forged tokens; tokens that
never expire

Verify Firebase ID token server-side; own
JWT with 15-min expiry, strong secret,
fixed algorithm; rotating refresh tokens
stored hashed; reuse = revoke all
sessions

API3 Object property
authorization (mass
assignment /
over-exposure)

App sends status:"LIVE" or
role:"ADMIN"; API returns phone and
internal fields

Strict Zod input schemas with
allow-listed fields; explicit output
schemas; tests that forbidden fields are
ignored and never returned

API4 Unrestricted
resource consumption

Thousands of requests, huge uploads,
page size 10,000

Rate limits per IP, user and device
(Redis); body size 1 MB; upload 5 MB;
max 50 per page; query timeouts; job
queue for heavy work

API5 Broken function level
authorization

Normal user calls
/admin/payments/approve

Admin routes in a separate prefix with
role middleware; deny by default; tests
for every admin route with a normal
token

API6 Sensitive business
flows

Bots scrape all phone numbers; abuse
trials, coupons, referrals

Contact-reveal limit per day; App Check
on contact; one trial per phone+device;
coupon/referral limits; anomaly alerts

API7 Server-side request
forgery

Server fetches a URL given by the user
and reaches internal services

The server never fetches user-supplied
URLs; uploads go directly to storage via
signed URLs

API8 Security
misconfiguration

Debug routes, open CORS, verbose
errors, default passwords

Production config checklist; CORS only
for admin domain; security headers;
generic errors; no docs endpoint in
production

API9 Improper inventory

Old test endpoints or staging left open

One list of endpoints (appendix A);
staging behind login/IP allowlist; remove
unused routes

API10 Unsafe use of other
APIs

Trusting Firebase or webhook data
blindly

Validate all third-party responses;
timeouts and retries; verify signatures

SQL injection

Text in search box changes the
database query

Prisma parameterised queries only;
full-text search with bound parameters

Race conditions

Two requests at once approve twice or
use a coupon twice

Transactions with row locks; unique
constraints; idempotency keys on
payment and approve endpoints

User enumeration

Login responses reveal whether a
number is registered

Same response for new and existing
numbers

ReDoS / heavy regex

Crafted text makes a regex take
seconds

Simple, tested regexes; input length
limits before regex

Attack / loophole

How it happens

How we stop it

Insecure uploads

Script disguised as image; huge-pixel
"decompression bomb"; GPS location in
photo

Check file content (magic bytes),
JPEG/PNG/WebP only, max 5 MB and
8,000 px; re-encode to WebP (removes
EXIF/GPS and hidden data); random file
names; private bucket

## 18. Admin panel: loopholes and fixes

The admin panel is the most powerful part of the system, so it gets the strongest
protection.
Attack / loophole

How it happens

How we stop it

Stored XSS

Lister writes <script> in an item title; it
runs when admin opens the review
queue and steals the session

React escapes text by default; never use
dangerouslySetInnerHTML; server strips
HTML; strict Content-Security-Policy (no
inline scripts)

CSRF

Admin visits a bad site that silently
submits "approve payment"

Session cookie HttpOnly + Secure +
SameSite=Strict; CSRF token on every
change; check Origin header

Clickjacking

Admin page loaded in a hidden frame

frame-ancestors 'none' and
X-Frame-Options DENY

Password guessing

Bots try common passwords

Argon2 hashing; 2-step code (TOTP)
required; lock after 5 failures for 15 min;
CAPTCHA after 3 failures; alert on
lockout

Stolen session

Session cookie copied from a shared
computer

8-hour max session, 30-min idle timeout,
re-login with 2-step code for sensitive
actions (UPI change, giving paid plans,
adding admins); list and revoke sessions

Too much power

One admin account can do everything

Roles: ADMIN (daily work) and
SUPER_ADMIN (settings, admins, ID
documents); least privilege

Insider misuse

Admin approves fake payments or
exports user data

Audit log of every action (cannot be
edited); daily summary to Super admin;
no bulk export of phone numbers

Admin panel found by
bots

Login page attacked from everywhere

Separate admin sub-domain, not linked
anywhere; optional IP allowlist for
office/home; web firewall rules

Open redirect

Link like ?next=evil.com after login

Only relative, allow-listed redirect paths

Sensitive data on screen

Screenshots shared outside

Phone numbers masked by default with
"show" action that is logged

## 19. Bots, scraping and fraud

Marketplaces are attacked more by bots and fraudsters than by classic hackers. These
controls are built into the business flows.
Attack / loophole

How it happens

How we stop it

SMS pumping (fake OTP
requests to burn money)

Bots request thousands of OTPs to
premium numbers

Firebase SMS region policy: allow India
only; App Check enforced on Auth;
reCAPTCHA SMS defense; per-number
and per-device limits; daily budget alert

Phone number scraping

Bot opens every listing and taps
WhatsApp

Numbers only via /contact for logged-in
users with App Check; max 30
owners/day; alert at repeated limit hits;
auto-block after abuse

Listing scraping

Competitor copies all listings

Search rate limits; max 50 per page; App
Check on list endpoints; watermark-free
but resized images

Fake accounts

Many accounts created to post spam or
abuse trials

One account per verified phone; device
id + Play Integrity; trial once per phone
and device; new-account limits for first
24 hours

Spam and scam listings

"iPhone ₹50/day, pay advance"

Text filter for phone numbers, links and
scam words; price outlier check;
duplicate-photo hash; review queue; 3
reports auto-hide

Fake payment proof

Edited screenshot, reused UTR

Section 13 rules; admin matches bank
statement; unique UTR

Coupon / referral farming

Same person creates accounts to
collect rewards

Rewards only after a paid approved
payment; device and phone checks;
monthly caps

DDoS / traffic floods

Huge traffic to take the service down

CDN / web firewall in front; rate limits at
proxy and app; auto-scaling plan; static
pages cached

Credential stuffing on
admin

Leaked passwords from other sites
tried

2-step login always; unique strong
passwords from the password manager

## 20. Server and infrastructure hardening

Area

Setting

Operating system

Latest Ubuntu LTS; automatic security updates; reboot window weekly at night

Login to server

SSH keys only; root login off; password login off; non-standard user with sudo; fail2ban

Firewall

Allow only 22 (from team IPs), 80 and 443. Database and Redis listen only on the private
Docker network

HTTPS

TLS 1.2+ only, automatic certificates, HSTS (1 year), HTTP → HTTPS redirect

Security headers

Content-Security-Policy, X-Content-Type-Options nosniff, Referrer-Policy,
Permissions-Policy, frame-ancestors none

Containers

Official images pinned by version; run as non-root; read-only file system where possible;
resource limits

Database

Separate app user with only the needed rights; no superuser for the app; strong random
password; daily encrypted backups; point-in-time recovery if available

Redis

Password protected; not exposed; no dangerous commands

Object storage

Private buckets; separate bucket for ID documents; keys limited to one bucket each;
lifecycle rules for deletion

Secrets

Environment files with 600 permissions on the server; values in the password manager;
rotate every 6 months and after any team change

CI/CD

GitHub Actions pinned to exact versions; secrets only in protected environments;
production deploy needs manual approval

Staging

Protected by login or IP allowlist; never uses production data

Monitoring

Uptime checks every minute; CPU/RAM/disk alerts; error-rate alerts; certificate expiry
alerts

Backups

Daily encrypted database backup + weekly storage backup, kept 30 days in a separate
account/location; monthly restore test

## 21. Data protection, privacy and incident

response
Follows India's Digital Personal Data Protection Act 2023 and DPDP Rules 2025, and Google
Play's User Data policy.

Privacy controls
• Collect only: phone, name, city, approximate area, listing content, payment proof, device
token. No Aadhaar, PAN, date of birth or bank details.
• Clear consent notice at sign-up (what, why, how long, how to withdraw), stored with version
and time.
• Account deletion inside the app and on a public web page; completed within 7 days; listed in
the Play Data safety form.
• Grievance officer name and email in the app and Privacy Policy; replies within the legal time
limit.
• Data and backups stored in India; access limited to named staff.

Retention
Data

Kept for

Account and listings

Until deletion request (+7 days to complete)

Payment records

As required by tax law, in anonymised form after account deletion

Payment screenshots

180 days after decision

ID documents

30 days after decision

Security and access logs

1 year (DPDP Rules)

Search logs

No user id; 12 months

Backups

30 days rolling

Logging rules
• Log: request id, route, status, time, user id, IP, app version.
• Never log: OTPs, tokens, passwords, full phone numbers, ID images, screenshots, full request
bodies.
• Logs are stored centrally, access-controlled and kept 1 year.

Incident response plan
Step

What to do

Who

## 1. Detect

Alert from monitoring, Sentry, user report or admin

Vimal Tiwari

## 2. Contain

Block attacker IPs/accounts, rotate keys, disable affected feature, keep
logs

Vimal Tiwari

## 3. Assess

What data, how many users, since when

Vimal Tiwari + Daman
Singh

Step

What to do

Who

## 4. Notify

Affected users without delay; Data Protection Board initial notice
immediately and detailed report within 72 hours; Google if Play policy
affected

Daman Singh

5. Fix

Patch, test, deploy, restore from backup if needed

Vimal Tiwari

## 6. Learn

Write what happened and what changes, add tests

Both

## 22. Security testing plan

Automatic checks (every pull request)
Tool

What it finds

Fails the build when

Unit + API tests (Vitest,
Supertest)

Broken rules, missing authorization

Any test fails

TypeScript strict + ESLint

Type and code-quality errors

Any error

Semgrep (OWASP rules)

Insecure code patterns

Any High finding

Gitleaks

Secrets committed by mistake

Any secret

npm audit / Dependabot

Vulnerable packages

High or Critical

flutter analyze + tests

App code issues

Any error

Before every release to testers or public
Tool

What it finds

OWASP ZAP baseline scan (API, admin, public
pages)

Missing headers, misconfiguration, common web issues

MobSF scan of the release APK/AAB

Hard-coded secrets, insecure settings, exported
components, permissions

k6 load test

Rate limits work; API stays fast under load

Restore test

Backups can really be restored

Manual attack tests (run with Postman / a second phone)
#

Test

Expected

T1

User A edits, deletes or reads user B's listing, payment, notification

403/404, nothing changed

T2

Normal user token on every /admin route

403

T3

Send status, role, featuredUntil, userId, amount in requests

Ignored or 400

T4

Same UTR from two accounts

Second rejected

T5

Change amount in the payment request

Server amount used

T6

Approve the same payment twice at the same time

One subscription only

T7

Use a coupon beyond its limit (parallel requests)

Refused

T8

Activate the same free plan twice / after reinstall

Refused

T9

Contact 31 different owners in a day

Blocked at 31

T10

Request search page size 1,000

Capped at 50

T11

Upload .svg, .php, renamed .exe, 30 MB image, 20,000 px image

All rejected

T12

Check uploaded photo for GPS data

None

T13

Item title with <script>alert(1)</script>; open in admin

Shown as text, no popup

T14

Submit admin form from another website

Blocked (CSRF)

T15

Load admin inside an iframe

Blocked

T16

Reuse an old refresh token

All sessions revoked

#

Test

Expected

T17

Blocked user's old token

401

T18

Search and list responses

No phone number anywhere

T19

Decompile release APK (jadx)

No secrets, code obfuscated

T20

Requests without App Check token to protected endpoints

Rejected

T21

SQL-like text and very long text in every input

Handled safely

T22

Login with registered vs new number

Same response

T23

Open staging without login

Blocked

T24

Port scan the server

Only 80/443 (and SSH from
team IPs) open

## 23. Phase plan overview

Phase 0

Phase 1

Phase 2

Phase 3

Setup

Foundation

Listings + search

Plans + payments

Phase 7

Phase 6

Phase 5

Phase 4

Run + maintain

Public launch

Launch features

Play Store ready

Phases 0–4 end with closed testing on Google Play; Phases 5–6 run while testing continues

Week

Phase

Milestone

1

0 Setup + start of 1

All accounts, repo, CI, servers, design kit ready

2

1 Foundation

Login, cities, categories, admin login working on staging

3

2 Listings and search

Items, photos, search, WhatsApp connect on staging

4

3 Plans, payments, admin

Admin-made plans, UPI payments, notifications, full admin panel

4–5

4 Play Store ready

Closed testing live (14-day clock starts if personal account)

5–6

5 Launch features

Trial, referral, coupons, requests, near-me, badge, boost, shop
page, Hindi, insights

6–7

6 Hardening + launch

Security test, load test, production release

After

7 Run + maintain

Monitoring, updates, support

How testing and building run in parallel
• After Phase 4, every finished card from Phase 5 is released to the same closed-testing track
(new build number).
• Testers get an update every 3–5 days; their feedback becomes fix cards with priority.
• Production access is requested only after Phase 6's gate passes and the 14-day testing rule is
met.

## 24. Phase 0 — Setup

Goal: everything needed to build safely is ready, and nothing is in a personal account.
ID

Task

Details and acceptance

P0-01

Company accounts

Create all accounts in section 4 in Daman Singh's name; 2-step login on
all; share access with Vimal Tiwari via the password manager.

P0-02

D-U-N-S and Play Console

Apply for D-U-N-S number and organization Play Console (can take
weeks — start day 1). Pay the one-time registration fee.

P0-03

Firebase projects

Two projects: rentnook-staging and rentnook-prod. Enable Phone Auth,
Cloud Messaging, App Check (Play Integrity). Set SMS region policy to
India only. Set budget alerts.

P0-04

Restrict Firebase API keys

In Google Cloud credentials, restrict Android keys to package name +
SHA-256 of debug/upload/Play signing certificates; restrict to needed
APIs only.

P0-05

Domain and DNS

Domain in company name; sub-domains: api., admin., www. (public
pages), staging-api., staging-admin.; DNS-level protection if available.

P0-06

Servers

Staging and production Linux servers in India; apply every item in
section 20; Docker + reverse proxy with automatic HTTPS.

P0-07

Object storage

Buckets: photos-staging, photos-prod, private-docs-prod (ID + payment
proofs); all private; lifecycle rules; scoped keys.

P0-08

Repository

GitHub org + private repo; folder structure (section 5); branch
protection; CODEOWNERS; Dependabot; secret scanning on.

P0-09

CLAUDE.md and docs

Add CLAUDE.md (7.1), BUILD_PLAN.md, PROGRESS.md, DECISIONS.md,
SECURITY_REVIEW.md.

P0-10

Backend skeleton

Fastify + TypeScript strict + Prisma + Zod + pino logger (with
redaction) + health endpoint + error handler + helmet headers +
rate-limit plugin + CORS config.

P0-11

Admin skeleton

React + Vite + TypeScript; routing; design tokens; login page
placeholder.

P0-12

App skeleton

Flutter project, package name (e.g. in.rentnook.app), flavors
staging/prod, design tokens, fonts bundled, Riverpod + go_router + Dio
setup, network security config (no cleartext), release config (section
16).

P0-13

CI pipelines

On every pull request: lint, typecheck, tests, Semgrep, Gitleaks, npm
audit, flutter analyze/test. On main: deploy to staging.

P0-14

Design kit

Build tokens and core components (section 8) in both admin and app;
component gallery screen for review.

P0-15

Seed data

Realistic seed data written by a person: 5 cities, 12 areas, 6 categories,
40 listings with Indian names and prices (staging only).

P0-16

Monitoring

Sentry in app, admin and backend (with personal-data scrubbing);
uptime checks; server alerts.

Checks
GATE — all must pass before the next phase
☐ All accounts owned by the company; 2-step login on every account
☐ CI runs green on an empty feature branch; Gitleaks, Semgrep and npm audit active
☐ Staging API reachable only over HTTPS; health endpoint returns OK; port scan shows only 80/443

(+SSH from team IPs)
☐ Security headers present (checked with a header scanner)
☐ Firebase SMS region = India only; App Check registered; API keys restricted
☐ Flutter staging build installs on a real phone and shows the component gallery
☐ Component gallery passes UI checklist U1–U4, U11
☐ PROGRESS.md has the Phase 0 report

## 25. Phase 1 — Foundation: login, cities,

categories, admin access
Goal: a secure base that every later feature builds on.
ID

Task

Details and acceptance

P1-01

Database schema v1

User, Session, DeviceToken, ConsentLog, City, Area, CityWaitlist,
Category, Setting, AuditLog. Migrations checked into git.

P1-02

Auth middleware

Verify App Check token (where required) → verify our access JWT (fixed
algorithm, 15-min expiry) → load user → reject BLOCKED/DELETED.

P1-03

Login API

POST /auth/firebase: verify Firebase ID token server-side, create/find
user by verified phone, issue access + refresh token. POST
/auth/refresh (rotate, reuse detection), POST /auth/logout.

P1-04

Rate limits

Redis-backed: /auth/* 10/min per IP and 5/min per device; global
100/min per IP; tighter limits configurable in Settings.

P1-05

Profile API

GET/PATCH /me (name, city, language only). Consent recorded on first
login.

P1-06

Cities and areas

GET /cities (open + coming soon), POST /cities/:id/waitlist. Admin CRUD
+ open/close with audit log.

P1-07

Categories

GET /categories (active only). Admin CRUD with English/Hindi names,
icon, order, fields schema.

P1-08

Admin auth

Email + password (Argon2) + TOTP 2-step; session cookie (HttpOnly,
Secure, SameSite=Strict); CSRF token; lockout; idle timeout; roles
ADMIN/SUPER_ADMIN; first Super admin created by a one-time CLI
command, not an open signup.

P1-09

Audit log

Middleware that writes AuditLog for every admin write; read-only
viewer for Super admin.

P1-10

App: onboarding

Screens: Welcome, Mobile number (+91, 18+ consent), OTP
(auto-read), Name + City, Coming soon. Tokens in secure storage.
Guest mode.

P1-11

App: shell

Bottom navigation (Home, Search, Saved, Profile), empty states, offline
banner, error handling, logout.

P1-12

Admin: shell

Login, 2-step setup screen, sidebar, Cities, Categories, Settings
(support contact, limits), Audit log.

P1-13

Public pages v1

Privacy Policy and Terms (draft text from section 21, reviewed by
Daman Singh) served on the www sub-domain.

Tests to write
• Token tests: expired, wrong signature, wrong algorithm, blocked user, refresh reuse.
• Authorization tests for every admin route with a normal user token.
• Rate-limit test for /auth.
• Admin lockout and 2-step tests; CSRF test.
• Flutter widget tests for onboarding screens; integration test: guest → sign up → home.
GATE — all must pass before the next phase
☐ All tests green; coverage of backend auth module ≥ 90%
☐ Manual tests T2, T16, T17, T22 pass (section 22)

☐ OTP works on a real phone with a real Indian number; non-Indian number refused
☐ Admin cannot log in without the 2-step code; 5 wrong tries lock the account
☐ Closed city shows Coming soon; Notify me saves waitlist
☐ Security review (7.4) on all Phase 1 code: no open Critical/High
☐ UI review (7.5) on onboarding and admin screens passes
☐ PROGRESS.md Phase 1 report written

## 25b. Phase 1 — screens to build

Every screen below is built, tested and security-checked inside Phase 1. The "Done when"
line of every card is part of this phase's gate.
Code

Meaning

A-

Mobile app screen (Flutter, Android first)

W-

Admin panel screen (website, laptop/tablet)

P-

Public web page (opens in any browser, no login)

A-01 Splash and Welcome
Field

Detail

Where

App

Purpose

First screen; explains the app in 5 seconds and lets people start or just look around.

On the screen

Logo on teal (no gradient) → white screen with app name, one line "Rent anything, near
you", 3 short benefits with icons, button "Continue with mobile number", text button "Just
browse".

How it works

Splash shows while the app checks for a saved session (max 1.5 s). Saved valid session →
Home. No session → Welcome. "Just browse" → Home as guest.

States

Offline: banner "No internet — showing saved items" and retry.

Checks and
errors

App version below minimum (from server) → full-screen "Please update" with Play Store
button.

API

GET /settings/public (min app version, support contact).

Security

No personal data on this screen. Session check reads tokens only from secure storage.

Done when

Opens in < 2.5 s on a low-end phone; force-update works; guest reaches Home.

A-02 Sign in — mobile number
Field

Detail

Where

App

Purpose

Single sign-in and sign-up for all customers (seekers and listers). No passwords.

On the screen

Title "Enter your mobile number", +91 fixed prefix, 10-digit number box (numeric
keyboard), checkbox "I am 18+ and agree to Terms and Privacy Policy" with links, button
"Send OTP", small note "Your number is never shown publicly".

How it works

1) User types number. 2) Button enabled only when 10 digits and checkbox ticked. 3) App
gets an App Check token, then asks Firebase to send OTP. 4) Moves to OTP screen.

States

Sending: button shows loader and is disabled (no double tap).

Checks and
errors

Number must start with 6–9 and be 10 digits. Errors: "Enter a valid 10-digit mobile number";
too many attempts: "Please try again after 10 minutes"; network error with retry.

API

Firebase Auth (sendVerificationCode).

Security

SMS region policy India only; App Check + reCAPTCHA SMS defense; per-number limit 3
OTPs / 10 min, per-device limit; same message whether the number is new or registered (no
user enumeration); number not logged.

Field

Detail

Done when

OTP arrives on a real Indian number; foreign numbers refused; 4th request in 10 minutes
blocked.

A-03 Sign in — OTP
Field

Detail

Where

App

Purpose

Prove the user owns the number.

On the screen

"Enter the 6-digit code sent to +91 98XXXXXX10", 6 boxes (auto-fill from SMS on Android),
resend timer 30 s, "Change number" link, button "Verify".

How it works

1) Code auto-filled or typed. 2) Firebase verifies → returns ID token. 3) App sends ID token +
App Check token to POST /auth/firebase. 4) Server returns access + refresh token. 5) New
user → Profile setup; existing user → Home (or the screen they came from).

States

Verifying loader; wrong code shake + message; expired code message with resend.

Checks and
errors

Max 5 wrong codes then wait; resend only after timer.

API

POST /auth/firebase.

Security

Server verifies Firebase token signature, project and expiry; phone taken only from the
verified token, never from the app; tokens stored in secure storage (Keystore); refresh
token rotated on use; blocked users get a clear message.

Done when

Login works on 3 phones; tampered token rejected (test); tokens not visible in app storage
files.

A-04 Profile setup (first time only)
Field

Detail

Where

App

Purpose

Collect the minimum: name and city.

On the screen

Name box (2–40 letters), city picker (opens A-05), button "Continue".

How it works

Saves profile; records consent version and time; goes to Home or back to the action that
needed login (for example WhatsApp contact).

Checks and
errors

Name: letters, spaces, dots only; no numbers or links.

API

PATCH /me; consent saved server-side.

Security

Only name, city, language can be changed by the user (strict schema); role, status, isLister
ignored.

Done when

Mass-assignment test passes (T3); consent row exists.

A-05 Choose city
Field

Detail

Where

App

Purpose

Show open cities and coming-soon cities.

On the screen

Search box, list of cities with state; open ones selectable; others tagged "Coming soon".

RentNook — Build and Launch Plan

Field

Detail

How it works

Open city → saved → Home refreshes. Coming-soon city → A-06.

States

Loading skeleton; error with retry.

API

GET /cities.

Security

Public data only.

Done when

City change refreshes Home and Search.

v2.0 · 23 November 2026

A-06 Coming soon
Field

Detail

Where

App

Purpose

Keep users interested in cities not yet open.

On the screen

City name, short message, button "Notify me when it opens", link "Choose another city".

How it works

Notify me → saves to waitlist (needs login; guest is asked to sign in first) → confirmation
text.

Checks and
errors

One waitlist entry per user per city.

API

POST /cities/:id/waitlist.

Security

Rate limited; login required.

Done when

Waitlist entry visible in admin W-04.

A-07 App shell: bottom bar, offline, errors
Field

Detail

Where

App

Purpose

Common frame for all main screens.

On the screen

Bottom bar: Home, Search, (My items for listers), Saved, Profile. Offline banner. Global error
toast.

How it works

Guest tapping Saved/Profile → sign-in prompt sheet. Token refresh happens silently; if
refresh fails → back to sign-in with message.

States

Offline, server down, session expired — each has its own message.

API

POST /auth/refresh.

Security

On logout: tokens deleted, push token removed from server, cached personal data cleared.

Done when

Logout leaves no tokens on device (checked with adb backup / file inspection on a test
build).

W-01 Admin sign in
Field

Detail

Where

Admin web

Purpose

Only staff can enter the admin panel.

On the screen

Email, password, button "Sign in"; then 6-digit authenticator code screen. No "Sign up" link.

Field

Detail

How it works

Correct email + password → code screen → correct code → Dashboard. Session cookie set
(HttpOnly, Secure, SameSite=Strict).

States

Loading; locked account message.

Checks and
errors

Generic error "Email, password or code is wrong" (never says which); 5 failures → 15-min
lock + alert; CAPTCHA after 3 failures.

API

POST /admin/auth/login, POST /admin/auth/2fa.

Security

Argon2 passwords; TOTP required for everyone; CSRF token; 8-h session, 30-min idle;
admin sub-domain not linked anywhere; optional IP allowlist.

Done when

Cannot enter without code; lockout works; cookies have correct flags (checked in browser
tools).

W-02 Two-step setup and admin accounts
Field

Detail

Where

Admin web

Purpose

First login sets up the authenticator app; Super admin manages staff accounts.

On the screen

QR code + backup codes (shown once); Admins list (Super admin only): name, email, role,
last login, disable.

How it works

First Super admin is created by a one-time server command. New admins are invited by
email link valid for 24 h.

Checks and
errors

Strong password rules (12+ characters, not in common-password list).

API

/admin/auth/totp-setup, /admin/admins.

Security

Re-enter code before adding admins or changing roles; audit logged; disabled admin
sessions end immediately.

Done when

ADMIN role cannot open this page (T2-style test).

W-03 Cities
Field

Detail

Where

Admin web

Purpose

Open, close and add cities.

On the screen

Table: city, state, live items, users, waitlist, status, Open/Closed switch; "Add city" form;
areas list per city.

How it works

Switch → confirm dialog explaining effect → saved → closing hides items, opening notifies
the waitlist.

Checks and
errors

Unique city name per state.

API

/admin/cities, /admin/areas.

Security

ADMIN+ only; audit logged; CSRF.

Done when

Closing a city hides its items in the app within 1 minute.

W-04 Categories
Field

Detail

Where

Admin web

Purpose

Manage what can be listed.

On the screen

List with icon, English name, Hindi name, order, active switch, extra fields editor (e.g.
Vehicles: model, year, fuel).

How it works

Changes appear in the app on next refresh.

Checks and
errors

Names required; order unique.

API

/admin/categories.

Security

Field definitions are data only (no code); audit logged.

Done when

New category visible in app; hidden one disappears.

W-05 Audit log
Field

Detail

Where

Admin web (Super admin)

Purpose

See every admin action.

On the screen

Filter by admin, action, date; row shows who, what, before/after, IP, time.

How it works

Read only.

API

GET /admin/audit.

Security

No edit or delete exists, even in the database user's rights.

Done when

Every action in Phase 1 appears here.

P-01 Privacy Policy and Terms (draft)
Field

Detail

Where

Public web

Purpose

Required for sign-up consent and Google Play.

On the screen

Plain pages with date and version; contact and grievance officer.

How it works

Linked from A-02 and app settings.

API

GET /privacy, /terms.

Security

Static, cached, security headers.

Done when

Pages open on phone and match the app.

## 26. Phase 2 — Listings, search and WhatsApp

connect
Goal: people can put items on rent (temporarily without plan checks), find them and
contact the owner safely.
ID

Task

Details and acceptance

P2-01

Schema v2

Listing, ListingImage, Favorite, Block, Report, SearchLog; full-text index
on title + description; geo fields.

P2-02

Photo upload

POST /uploads/sign returns a short-lived signed upload URL; app
compresses photos before upload; server worker validates (magic
bytes, size, pixels), re-encodes to WebP (removes EXIF/GPS), stores
width/height/hash; rejects bad files.

P2-03

Listing create/edit

POST/PATCH/DELETE /listings: strict schema (section 14 rules); owner
only; text filter removes phone numbers, links and emails; status
DRAFT/REVIEW/LIVE.

P2-04

Lister actions

Mark Rented out / Available, pause, delete; My items list (owner only).

P2-05

Search API

GET /listings with city, q, category, area, price range, period, verified,
sort (nearest/newest/price), cursor pagination (max 50). Only LIVE
items in open cities; output schema without phone or exact location.

P2-06

Distance

Approximate location rounded to ~500 m; distance computed from
user's chosen area or device location (permission asked only when user
taps "Near me").

P2-07

Item detail

GET /listings/:id public fields; view counted once per user per day.

P2-08

Contact

POST /listings/:id/contact: logged in, App Check, not blocked, listing
LIVE, daily limit; returns wa.me link with a ready message; counts
clicks.

P2-09

Save, report, block

Favorites, reports (reason list), blocks; 3 reports auto-hide; report
limits.

P2-10

App screens

Home (categories, latest), Search with filters and sort, Item page with
photo gallery, safety-tips sheet, WhatsApp open, Saved, Add/Edit item,
My items (basic), Report sheet.

P2-11

Admin screens

Listings list, search, review queue (when moderation is on),
hide/remove with reason, Reports list.

P2-12

Share links

https://www.<domain>/i/<short id> public page with title, photo, price
and "Open in app" (Android App Links + assetlinks.json); no phone
number.

Tests to write
• Owner-only edit/delete (T1), mass-assignment (T3), page size cap (T10), upload attacks (T11,
T12), contact limit (T9), XSS in admin (T13), no phone in lists (T18).
• Search correctness with filters; closed-city items never appear.
• Flutter integration: add item with photos → appears in search → open → WhatsApp intent fired.
GATE — all must pass before the next phase
☐ Manual tests T1, T3, T9–T13, T18, T21 pass
☐ A listing with 8 photos uploads on a slow 3G emulator profile without failing
☐ Search returns results in under 1 s on staging with 5,000 seeded items

☐ Uploaded photos contain no EXIF/GPS (checked with exiftool)
☐ WhatsApp opens with the correct number and message on 3 different phones
☐ Security review: no open Critical/High
☐ UI review + first human check (section 10): issues fixed
☐ PROGRESS.md Phase 2 report written

## 26b. Phase 2 — screens to build

Every screen below is built, tested and security-checked inside Phase 2. The "Done when"
line of every card is part of this phase's gate.
Code

Meaning

A-

Mobile app screen (Flutter, Android first)

W-

Admin panel screen (website, laptop/tablet)

P-

Public web page (opens in any browser, no login)

How a rental happens (no in-app booking)
In version 1 there is no in-app booking or payment between users. The seeker finds an item,
opens WhatsApp with a ready message, and the two people agree dates, rent and deposit
themselves. The lister then marks the item "Rented out" and later "Available". A booking calendar
is in the Later list (section 33).

A-08 Home
Field

Detail

Where

App

Purpose

Show what is available in the user's city at a glance.

On the screen

Top: city name (tap to change) and bell. Search bar (tap → Search). Category grid (6–8).
Banner "Can't find it? Request an item" (Phase 5). "Sponsored" row (Phase 3). "Latest in
[city name]" list.

How it works

Pull to refresh; infinite scroll for latest items; tapping an item → A-10.

States

Skeleton cards while loading; empty city: "No items yet in this city — be the first to list".

API

GET /categories, GET /listings?city=…&sort;=newest.

Security

Only public fields returned; responses cached briefly; page size max 50.

Done when

Loads in < 2 s on 4G; scroll smooth on low-end phone.

A-09 Search and filters
Field

Detail

Where

App

Purpose

Find the right item fast.

On the screen

Search box, category chips, Filters button (sheet: area, price range, per day/week/month,
verified only), Sort (Nearest, Newest, Lowest price), result count, results list, empty state
with "Request this item".

How it works

Typing waits 300 ms then searches; filters combine; results paginate; each search is logged
without user id for insights.

States

Loading, no results, error.

Checks and
errors

Query max 60 characters; numeric price fields.

API

GET /listings?q=&category;=&area;=&min;=&max;=.=&verified;=&sort;=&cursor;=.

Field

Detail

Security

Rate limit 60 searches/min per user/device; page size capped at 50; parameters validated;
SQL-safe full-text search; closed-city items never returned.

Done when

T10 and T21 pass; search < 1 s with 5,000 items.

A-10 Item page
Field

Detail

Where

App

Purpose

Everything needed to decide to contact the owner.

On the screen

Photo gallery (swipe, pinch zoom), category, title, rent per day/week/month, deposit,
condition, area + distance, description, owner first name, member since, verified mark,
Save, Share, Report. Fixed bottom button "Chat on WhatsApp".

How it works

Opening counts a view (once per user per day). Share → share link (P-02).

States

Item hidden/removed → "This item is no longer available".

API

GET /listings/:id.

Security

No phone number, exact address or exact location in the response; images through signed
or public resized URLs only.

Done when

Response checked: no phone field anywhere (T18).

A-11 Safety tips and WhatsApp contact
Field

Detail

Where

App

Purpose

Connect seeker and owner safely.

On the screen

Bottom sheet (first time only): 3 tips — meet in public, check the item, agree deposit and
return date in writing; never share OTPs. Button "Open WhatsApp".

How it works

1) Guest → sign-in first. 2) POST /listings/:id/contact with App Check token. 3) Server checks:
logged in, not blocked by owner, item LIVE, daily limit. 4) Returns wa.me link with ready
message. 5) App opens WhatsApp. 6) Click counted for owner's stats.

States

WhatsApp not installed → Play Store link for WhatsApp.

Checks and
errors

Daily limit reached: "You have contacted many owners today. Try again tomorrow."

API

POST /listings/:id/contact.

Security

Phone number only returned here, one at a time; max 30 owners/day; App Check required;
abuse alerts; message text encoded server-side.

Done when

T9 and T20 pass; WhatsApp opens with correct number on 3 phones.

A-12 Saved items
Field

Detail

Where

App

Purpose

Keep a shortlist.

On the screen

List of saved items with remove button; empty state.

Field

Detail

How it works

Heart on any card saves/unsaves instantly (optimistic, rolls back on error).

States

Empty: "Tap the heart on any item to save it".

API

GET/POST/DELETE /favorites.

Security

Owner-only list; IDs validated.

Done when

Saved list same on a second phone after login.

A-13 Report and block
Field

Detail

Where

App

Purpose

Let users flag scams and stop contact.

On the screen

Sheet with reasons (fake item, asks advance payment, wrong price, offensive, other +
note), button "Report"; on owner profile: "Block".

How it works

Report saved → thank-you message; 3 reports from different users auto-hide the item. Block
hides each other's items and stops contact.

Checks and
errors

One report per user per target; note max 300 chars.

API

POST /reports, POST/DELETE /blocks/:userId.

Security

Rate limited; reporter identity never shown to the owner.

Done when

Auto-hide after 3 reports works; blocked users cannot contact.

A-14 Add / edit item
Field

Detail

Where

App (listers)

Purpose

Put an item on rent in under 3 minutes.

On the screen

Steps on one scrolling form: Photos (1–8, reorder, delete), Title, Category, extra fields for
that category, Rent per day/week/month (at least one), Deposit, Condition (New / Like new /
Good / Fair), Area (from city areas), WhatsApp number (default: login number), Description.
Buttons "Save draft" and "Submit".

How it works

Photos compressed on phone → signed upload → server checks and re-encodes. Submit →
LIVE, or REVIEW if moderation is on; without an active plan (Phase 3) → saved as Draft with
"Choose a plan to go live".

States

Upload progress per photo; failed photo retry; leaving with unsaved changes asks to
confirm.

Checks and
errors

Title 8–80, description 20–1,000; prices in whole rupees 1–10,00,000; phone numbers, links
and emails removed from text with a warning.

API

POST /uploads/sign, POST/PATCH /listings.

Security

Owner set by server from token; status/featured/counts cannot be set by app; uploads
checked (T11, T12); text stripped of HTML.

Done when

Item with 8 photos posts on slow 3G; GPS removed from photos; T1, T3, T11–T13 pass.

A-15 My items (basic)
Field

Detail

Where

App (listers)

Purpose

Manage own items.

On the screen

List with photo, title, status pill (Draft / Under review / Live / Rented out / Hidden), actions:
Edit, Mark rented / available, Pause, Delete.

How it works

Delete asks to confirm; items are soft-deleted.

States

Empty: "Put your first item on rent".

API

GET /listings/mine, POST /listings/:id/status.

Security

Only own items returned and changed.

Done when

Another user cannot change status (T1).

W-06 Listings and review queue
Field

Detail

Where

Admin web

Purpose

Keep the marketplace clean.

On the screen

Tabs: Review queue, All items, Hidden. Card shows photos, title, price, lister, auto-warnings
(Phase 5). Actions: Approve, Reject (reason), Hide, Remove. Setting: "Review new items"
on/off.

How it works

Approve → LIVE + notification (Phase 3); Reject → reason to lister.

Checks and
errors

Reason required for reject/remove.

API

/admin/listings.

Security

User text shown as plain text only (XSS test T13); CSP; CSRF; audit log.

Done when

Script in a title never runs in admin.

W-07 Reports
Field

Detail

Where

Admin web

Purpose

Act on complaints.

On the screen

List: target, reason, reporter (masked), time, status; actions: remove item, warn, block user,
dismiss.

How it works

Every action needs a short note.

API

/admin/reports.

Security

Audit logged; reporter phone masked.

Done when

Report flow closes the loop end to end.

P-02 Shared item page
Field

Detail

Where

Public web

Purpose

Let shared links work for anyone.

On the screen

Photo, title, price, area, city, "Open in RentNook" button, Play Store button. No phone, no
owner name beyond first name.

How it works

Android App Links open the app directly if installed (assetlinks.json verified).

States

Item not live → "No longer available".

API

GET /i/:shortId.

Security

Short id not guessable; no personal data; cached; security headers.

Done when

Link opens app on Android and page in a desktop browser.

## 27. Phase 3 — Plans, payments, notifications and

full admin panel
Goal: the business works end to end — admin creates plans (paid and free), listers
subscribe, payments are verified, items go live, everyone is notified.
ID

Task

Details and acceptance

P3-01

Schema v3

Plan, Subscription, Payment, Coupon (table only, logic in Phase 5),
Notification; unique UTR; snapshot fields.

P3-02

Admin: plan builder

Create/edit/archive plans with every field in 12.1; preview as the app
shows it; validation (price ≥ 0, days 1–730, limit ≥ 1 or unlimited).

P3-03

Free plans

Type FREE/TRIAL with price 0: "Activate" button in app; eligibility
checks (max per user, city, dates, device); optional admin approval
queue.

P3-04

Manual plan assignment

Admin → User → Give plan, with reason; Super admin only for paid
plans; audit logged.

P3-05

Plans API

GET /plans (visible to this user, in their city, within dates); POST
/subscriptions (paid → creates PENDING + Payment with server
amount; free → activate or queue).

P3-06

UPI flow (app)

Plans screen → Pay via UPI (upi:// intent with server values; QR fallback)
→ Enter UTR + screenshot (FLAG_SECURE) → Status screen.

P3-07

Payment proof API

POST /payments/:id/proof: 12-digit UTR, unique; screenshot via signed
upload to private bucket; limits (3 pending, 10/day).

P3-08

Admin: payments queue

List with amount, UTR, screenshot (10-min signed link), user history;
Approve/Reject in a transaction with row lock + idempotency key;
reasons list.

P3-09

Plan enforcement

Listings go LIVE only with an active plan and within the limit; extra
become Draft; plan states and expiry job (12.4); reminders 7/3/1 days.

P3-10

Boost (paid)

Admin sets boost prices/days; lister buys boost via the same payment
flow; featuredUntil; city cap and queue.

P3-11

Notifications

FCM token register/unregister; push + in-app list for: payment
approved/rejected, item approved/rejected, plan expiring/expired, city
opened; admin broadcast (all / city / listers) with preview and rate limit.

P3-12

Admin: dashboard + users

Dashboard numbers; Users list, details, block/unblock (revokes
sessions, hides items), plan history.

P3-13

Admin: settings

Company UPI ID, payee name, QR image (Super admin + re-auth),
support contacts, grievance officer, limits.

P3-14

Lister dashboard (app)

Plan card (days left), views, WhatsApp chats, item count,
upgrade/renew buttons.

Tests to write
• T4–T8 (UTR reuse, amount tampering, double approve, coupon race placeholder, free plan
twice).
• Plan snapshot: editing a plan does not change existing subscriptions.
• Expiry job idempotent; reminders sent once.
• Listing limit enforcement on upgrade/downgrade.
• Admin role tests: ADMIN cannot change UPI ID or give paid plans free.

GATE — all must pass before the next phase
☐ Admin can create a paid plan and a free plan; both appear in the app within 1 minute without an app
update
☐ Full loop on staging with real UPI test payment (₹1 plan): pay → UTR → approve → item live → push
received
☐ Manual tests T4–T8 pass; parallel-approval test creates exactly one subscription
☐ Expired plan hides items; renewal restores them
☐ Every admin action visible in the audit log
☐ Security review: no open Critical/High; ZAP baseline on admin shows no High
☐ UI review + human check on Plans, UPI, Payment status, Admin payments: issues fixed; Daman Singh
approves the look
☐ PROGRESS.md Phase 3 report written

## 27b. Phase 3 — screens to build

Every screen below is built, tested and security-checked inside Phase 3. The "Done when"
line of every card is part of this phase's gate.
Code

Meaning

A-

Mobile app screen (Flutter, Android first)

W-

Admin panel screen (website, laptop/tablet)

P-

Public web page (opens in any browser, no login)

A-16 Plans
Field

Detail

Where

App

Purpose

Show every plan the admin created for this user and city.

On the screen

Free/trial plans on top ("Activate"), then paid plans: name, price, duration, item limit,
badge, description points; selected plan summary; coupon box (Phase 5); total; button "Pay
₹X via UPI" or "Activate free plan".

How it works

Plans load from server every time. Paid → A-17. Free → server checks eligibility → active (or
"waiting for approval" if admin set that).

States

No plans: "Plans will be available soon".

Checks and
errors

Already used free plan → "You have already used this offer".

API

GET /plans, POST /subscriptions.

Security

Amount computed by server; eligibility checked by server (max per user, city, dates,
device); app values ignored.

Done when

New plan created in admin appears here within 1 minute; free plan twice refused (T8).

A-17 Pay with UPI
Field

Detail

Where

App

Purpose

Send the exact amount to the company UPI ID without a gateway.

On the screen

Company name, UPI ID, amount, what it is for, buttons for installed UPI apps, QR code
fallback, note "After paying, come back and enter the UTR".

How it works

Builds upi://pay link from server values (payee, amount, note with payment reference).
Returns to app → A-18.

API

Payment created in POST /subscriptions or POST /listings/:id/boost.

Security

UPI ID and amount from server only; screen cannot be edited; no payment data stored on
phone.

Done when

Works with Google Pay, PhonePe, Paytm, BHIM; correct amount appears in each.

A-18 Enter UTR
Field

Detail

Where

App

Purpose

Collect proof of payment.

On the screen

UTR box (12 digits) with help image showing where to find it, "Attach screenshot (optional)",
payment summary, button "Submit".

How it works

Screenshot uploaded to private storage via signed URL; UTR and screenshot linked to the
payment; status → Pending.

States

Uploading progress.

Checks and
errors

UTR must be 12 digits; already used → "This UTR has already been used"; max 3 pending
and 10 submissions/day.

API

POST /payments/:id/proof.

Security

Unique UTR in database; FLAG_SECURE (no screenshots of this screen by other apps);
screenshot private and expires.

Done when

T4 and T5 pass.

A-19 Payment status
Field

Detail

Where

App

Purpose

Show where the payment is.

On the screen

Timeline: Submitted → Checking → Approved / Rejected (reason, "Submit again").

How it works

Updates via push and on screen refresh.

API

GET /payments/mine.

Security

Own payments only.

Done when

Approve in admin → status here + push within 1 minute.

A-20 Lister dashboard (My items full)
Field

Detail

Where

App (listers)

Purpose

Show value and control.

On the screen

Plan card (name, days left, Renew/Upgrade), numbers (views, WhatsApp chats, items live /
limit), items list with Boost and Share actions.

How it works

Over the limit → extra items listed as Draft with explanation.

API

GET /me/lister-summary.

Security

Counts computed by server; own data only.

Done when

Numbers match admin.

A-21 Boost an item
Field

Detail

Where

App (listers)

Purpose

Paid top position.

On the screen

Options set by admin (3/7/15 days with prices), current boost end date, button "Pay via UPI"
(or "Use boost credit" in Phase 5).

How it works

Same payment flow (A-17 → A-19); boost starts on approval; city cap queue.

Checks and
errors

Only LIVE items can be boosted.

API

POST /listings/:id/boost.

Security

Owner only; amount from server; same fraud rules as plans.

Done when

Boosted item shows "Sponsored" in Home after approval.

A-22 Notifications
Field

Detail

Where

App

Purpose

All messages in one place.

On the screen

List with icon, title, text, time, unread dot; tap opens the related screen.

How it works

Push permission asked at a useful moment (after first listing or first save), not on first
launch.

States

Empty state.

API

GET /notifications, POST /notifications/read, POST /devices.

Security

Push bodies contain no phone numbers or private data.

Done when

Each event type in section 16 of the PRD arrives.

A-23 Profile and settings
Field

Detail

Where

App

Purpose

Account control.

On the screen

Name, masked number, city, role, plan; Edit profile; Start renting out / My plan; Language
(Phase 5); Notifications; Help and safety; Terms and Privacy; Delete my account (Phase 4);
Log out.

API

GET/PATCH /me.

Security

Masked number only; logout clears device data.

Done when

All links work; logout clean.

W-08 Dashboard
Field

Detail

Where

Admin web

Purpose

Daily overview.

Field

Detail

On the screen

Cards: users, active listers, live items, pending payments, revenue this month; revenue
trend; recent activity; city filter.

States

Loading skeletons.

API

GET /admin/dashboard.

Security

Aggregates only; no phone lists.

Done when

Numbers match database queries in a test.

W-09 Plan builder
Field

Detail

Where

Admin web

Purpose

Create and manage every plan (paid, free, trial, business, boost prices).

On the screen

Plans table (name, type, price, days, limit, visibility, active subscribers, status); "New plan"
form with all fields from section 12.1; live preview of how it looks in the app; Archive button.

How it works

Save → validation → plan live in app. Editing affects only new purchases. Plans with buyers
cannot be deleted, only archived.

Checks and
errors

Price ≥ 0; days 1–730; limit ≥ 1 or unlimited; free plans need "max per user".

API

/admin/plans.

Security

Creating/editing plans: ADMIN+; making a paid plan free for a user: Super admin; audit
logged with before/after.

Done when

Paid and free plan created and bought/activated end to end.

W-10 Payments queue
Field

Detail

Where

Admin web

Purpose

Verify UPI payments quickly and safely.

On the screen

Tabs Pending / Approved / Rejected; row: user (masked), purpose, amount, UTR, time,
screenshot button, user's past payments; Approve; Reject with reason list.

How it works

Approve → one database transaction (lock, status check, idempotency key) →
subscription/boost active → push. Reject → reason + push.

Checks and
errors

Duplicate UTR flagged red and cannot be approved.

API

/admin/payments.

Security

Screenshot via 10-min signed link; ADMIN+ only; every decision audit-logged; daily
summary to Super admin.

Done when

Parallel approve creates exactly one subscription (T6).

W-11 Users and user detail
Field

Detail

Where

Admin web

Purpose

Manage customers.

On the screen

Search by name or last 4 digits; table; detail page: profile, items, plans, payments, reports;
actions Block/Unblock, Give plan (with reason), Show full number (logged).

How it works

Block → all sessions revoked, items hidden.

Checks and
errors

Reason required for block and give plan.

API

/admin/users.

Security

No bulk export of phone numbers; "show number" audit-logged.

Done when

Blocked user is logged out on next request (T17).

W-12 Push notifications
Field

Detail

Where

Admin web

Purpose

Send messages to users.

On the screen

Audience (all / city / listers), title (max 60), message (max 160), preview, history.

How it works

Send → queued job → sent in batches.

Checks and
errors

Confirmation dialog shows audience size.

API

/admin/push.

Security

Max 3 broadcasts/day; ADMIN+; audit logged.

Done when

Test push received on 3 phones.

W-13 Settings
Field

Detail

Where

Admin web (Super admin)

Purpose

Business settings.

On the screen

Company UPI ID, payee name, QR image, support WhatsApp/email, grievance officer, limits
(contacts/day, reports to hide), minimum app version.

How it works

Changing UPI ID requires re-entering the 2-step code; change notified to all Super admins.

Checks and
errors

UPI ID format check.

API

/admin/settings.

Security

Super admin only; audit logged.

Done when

ADMIN cannot open; UPI change alert received.

## 28. Phase 4 — Play Store ready and closed testing

Goal: a signed, hardened build that passes Google Play's checks and is live on the
closed-testing track.
ID

Task

Details and acceptance

P4-01

Account deletion (in app)

Profile → Delete my account → confirm with OTP → request created →
listings hidden immediately → full deletion job within 7 days →
confirmation notification.

P4-02

Account deletion (web)

Public page www.<domain>/delete-account: enter phone → OTP →
confirm; also explains what is deleted and kept. Required link for the
Data safety form.

P4-03

Legal pages final

Privacy Policy (data collected, purpose, retention, sharing, rights,
grievance officer, deletion), Terms (platform not party to deals, banned
items, refunds, plan rules). Reviewed by Daman Singh; dated.

P4-04

In-app legal links

Links in sign-up, Profile and Plans; Help and safety page; grievance
contact.

P4-05

Permissions audit

Only INTERNET, camera/photos (when adding photos), notifications
(Android 13+ runtime prompt), approximate location (only on Near
me). No contacts, SMS, call logs.

P4-06

Release configuration

targetSdk 36; minSdk 24; 16 KB page-size compatible build checked;
R8 + --obfuscate --split-debug-info; debuggable false; allowBackup
false; cleartext off; exported components reviewed; app version and
build number set.

P4-07

Signing

Upload keystore created and stored in the password manager + offline
backup; Play App Signing enrolled; SHA-256 of Play signing key added
to Firebase and API key restrictions.

P4-08

App Check enforcement

Play Integrity provider in release; App Check enforced on Firebase Auth
and on backend sensitive endpoints (login, contact, payments) after
monitoring metrics for 2–3 days on staging.

P4-09

Production environment

Production server, database, storage, Firebase prod project, secrets,
backups, monitoring — all checked against section 20.

P4-10

Store listing

App name, short description (80 chars), full description (English +
Hindi), app icon 512×512, feature graphic 1024×500, 4–8 real
screenshots (no device frames with fake status bars), category
Shopping or Lifestyle, contact email, privacy policy URL.

P4-11

App content forms

Privacy policy, App access (give testers' demo login steps: OTP test
number from Firebase test phone numbers), Ads: No, Content rating
questionnaire, Target audience 18+, Data safety form (appendix C),
Government apps: No, Financial features: No.

P4-12

Pre-launch report

Upload to internal testing first; fix every crash, accessibility and
security warning in the Play pre-launch report.

P4-13

Closed testing track

Create closed track, Google Group of testers (20+ real people), opt-in
link, feedback email/WhatsApp group; release notes.

P4-14

Tester guide

One-page guide: how to join, what to try each day, how to send
feedback with screenshots.

Google Play checklist (all must be true)
#

Requirement

Status check

G1

Target API level 36 (required for new apps and updates from 31
Aug 2026)

Check in App bundle explorer

G2

Supports 16 KB memory page sizes (required for apps targeting
Android 15+)

App bundle explorer shows
"Supports 16 KB"

G3

Signed with upload key; Play App Signing on

Play Console → App integrity

G4

Privacy policy URL works and matches the app

Open on phone

G5

Account deletion in app and via web link (in Data safety form)

Test both

G6

Data safety form matches real data collection

Compare with appendix C

G7

Content rating, target audience, ads declaration done

App content page all green

G8

App access instructions for reviewers (test number + OTP)

Reviewer can log in

G9

No crashes in pre-launch report

Report clean

G10

Permissions declared and justified; no restricted permissions

Manifest review

G11

Store listing assets real, no misleading claims

Review

G12

Closed track with testers; 12+ opted in for 14 days (personal
account) or organization account

Testers tab

GATE — all must pass before the next phase
☐ Every G1–G12 item true
☐ Release AAB passes MobSF with no High findings; jadx shows no secrets (T19)
☐ Manual tests T1–T24 all pass on production-like staging
☐ Pre-launch report has zero crashes
☐ Account deletion works end to end (app and web) and data is really removed after the job runs
☐ Closed-testing build installed by at least 5 testers on different phones
☐ Daman Singh signs off the store listing and legal pages
☐ PROGRESS.md Phase 4 report + release notes written

## 28b. Phase 4 — screens to build

Every screen below is built, tested and security-checked inside Phase 4. The "Done when"
line of every card is part of this phase's gate.
Code

Meaning

A-

Mobile app screen (Flutter, Android first)

W-

Admin panel screen (website, laptop/tablet)

P-

Public web page (opens in any browser, no login)

A-24 Delete my account
Field

Detail

Where

App

Purpose

Required by Google Play and DPDP.

On the screen

Explains what will be deleted and kept; reason (optional); confirm with OTP; final "Delete"
button.

How it works

Request created → items hidden at once → logout → deletion job completes within 7 days →
confirmation notification/SMS-free message on next attempt to log in.

Checks and
errors

Active paid plan warning (no refund per Terms).

API

POST /me/delete-request.

Security

OTP re-verification; cannot be triggered by another user; job removes photos, anonymises
user row.

Done when

Data really gone after job (database check).

A-25 Help, safety and legal
Field

Detail

Where

App

Purpose

Support and trust.

On the screen

Safety tips, how renting works, FAQs, contact support (WhatsApp/email), grievance officer,
Terms, Privacy.

How it works

Content from server settings so it can change without an app update.

States

Works offline with last saved copy.

API

GET /settings/public.

Security

Static content only.

Done when

All links open.

P-03 Delete account web page
Field

Detail

Where

Public web

Purpose

Let people delete their account without the app (Play Data safety link).

Field

Detail

On the screen

Phone number → OTP → confirm → request created; text explaining what is deleted and
kept.

How it works

Same deletion job as A-24.

Checks and
errors

Rate limited per IP and number.

API

/delete-account (web) using Firebase web OTP.

Security

reCAPTCHA / App Check for web; no account details shown on the page.

Done when

Deletion from web works end to end.

P-04 Privacy Policy and Terms (final)
Field

Detail

Where

Public web

Purpose

Final legal text.

On the screen

Versioned pages; date; changes list.

How it works

New version → app asks users to accept again at next login.

API

/privacy, /terms.

Done when

Daman Singh approved; links in Play Console.

## 29. Phase 5 — Launch features (during closed

testing)
Only the launch features already agreed with Daman Singh. Each card is released to the
closed track as soon as its checks pass.
ID

Task

Details and acceptance

P5-01

Free trial

Admin-created TRIAL plan (12.1) shown to new listers; once per phone
+ device; trial badge and countdown.

P5-02

Coupons

Admin CRUD; validate on server at checkout and again at approval;
per-user and total limits in a transaction; usage report.

P5-03

Refer a friend

Referral code + share link; reward days after referee's first approved
paid payment; self-referral and device checks; monthly cap.

P5-04

Share card

Server-generated image (photo, title, price, app link, logo) for
WhatsApp Status; never shows phone.

P5-05

Request an item

Seeker form; notify listers in city + category (active plan only); limits;
auto-close after dates.

P5-06

Near-me sorting

Optional location permission; rounded distances; fallback to chosen
area.

P5-07

ID-verified badge

Upload to private-docs bucket; Super admin review; badge on
profile/items; ID image auto-deleted 30 days after decision; every view
audit-logged.

P5-08

Shop page

BUSINESS plans: shop name, logo, timings, area, all items; public share
link.

P5-09

Monthly boost credits

Plans with boost credits get them each month; use from My items.

P5-10

Hindi

Full ARB translation reviewed by a native speaker; categories, plans
and notifications in Hindi; language switch in Profile; layouts checked
for longer words.

P5-11

Demand insights (admin)

Top searches, zero-result searches, category/city numbers; CSV export
without personal data.

P5-12

Auto-moderation

Scam-word list, price outliers per category, duplicate photo hash; flags
in review queue.

GATE — all must pass before the next phase
☐ Each card has passing tests, security review and UI review
☐ Coupon race test (T7) and free-trial-twice test (T8) pass
☐ Referral cannot be farmed with two accounts on one phone
☐ ID images not reachable by ADMIN role; deleted after 30 days in a time-shifted test
☐ Hindi human review done; no cut text on 360 px phones
☐ Human check (section 10) on new screens; issues fixed
☐ Each card released to closed testing and smoke-tested by 3+ testers

## 29b. Phase 5 — screens to build

Every screen below is built, tested and security-checked inside Phase 5. The "Done when"
line of every card is part of this phase's gate.
Code

Meaning

A-

Mobile app screen (Flutter, Android first)

W-

Admin panel screen (website, laptop/tablet)

P-

Public web page (opens in any browser, no login)

A-26 Free trial (in Plans)
Field

Detail

Where

App

Purpose

Let new listers try first.

On the screen

Trial card at top of Plans: "Free for 15 days, 1 item"; countdown on dashboard.

How it works

Uses the admin TRIAL plan; activates instantly.

Checks and
errors

Once per phone and device.

API

POST /subscriptions.

Security

Device id + Play Integrity verdict stored; second attempt refused.

Done when

T8 passes on reinstall and second account on same phone.

A-27 Refer a friend
Field

Detail

Where

App

Purpose

Grow through word of mouth.

On the screen

Personal code, share button, how it works, rewards earned.

How it works

Friend enters code at sign-up or in Plans; reward days added after friend's first approved
paid payment.

Checks and
errors

Own code refused; one code per account.

API

GET /referral, POST /referral/apply.

Security

Device checks; monthly cap; rewards only after real payment.

Done when

Two accounts on one phone cannot farm rewards.

A-28 Share card
Field

Detail

Where

App

Purpose

Free marketing for listers.

On the screen

Preview image (photo, title, price, logo, short link), buttons WhatsApp Status, Copy link,
More.

RentNook — Build and Launch Plan

Field

Detail

How it works

Image generated by server and cached.

API

GET /listings/:id/share-card.

Security

No phone number on the card; short link only.

Done when

Card shares to WhatsApp Status correctly.

v2.0 · 23 November 2026

A-29 Request an item
Field

Detail

Where

App

Purpose

Turn empty searches into leads.

On the screen

What do you need, category, from/to dates, button Post; My requests list.

How it works

Listers in city + category with active plan get a push; they reply on WhatsApp.

Checks and
errors

Max 5 per day; text 10–200 chars.

API

POST /requests, GET /requests/mine.

Security

Seeker number shared only via the contact endpoint rules; text filtered.

Done when

Matching lister receives push.

A-30 Near me
Field

Detail

Where

App

Purpose

Sort by distance.

On the screen

"Near me" sort; permission explanation sheet before the system prompt.

How it works

Approximate location only; falls back to chosen area if denied.

API

Uses existing search API.

Security

Location never stored with exact precision.

Done when

Denied permission still works.

A-31 Get ID verified
Field

Detail

Where

App (listers)

Purpose

Earn the verified badge.

On the screen

Explanation, ID photo upload (front), selfie optional [decision], status.

How it works

Upload to private-docs bucket; Super admin reviews in W-15; badge on approval.

Checks and
errors

JPG/PNG ≤ 5 MB.

API

POST /id-verifications.

Security

Separate bucket; Super admin only; every view logged; auto-delete 30 days after decision;
ID number never typed or stored.

RentNook — Build and Launch Plan

Field

Detail

Done when

ADMIN cannot see ID; deletion job works.

v2.0 · 23 November 2026

A-32 Shop page (Business plan)
Field

Detail

Where

App + public web

Purpose

Profile for rental shops.

On the screen

Edit: shop name, logo, area, timings, about. View: header + all items; share link.

How it works

Visible only while Business plan is active.

Checks and
errors

Name 3–50; logo ≤ 2 MB.

API

PUT /shops/me, GET /shops/:id.

Security

Owner only; logo checked like photos.

Done when

Shop page visible and shareable.

A-33 Language: English / Hindi
Field

Detail

Where

App

Purpose

Reach Hindi-first users.

On the screen

Switch in Profile; whole app, categories, plans and notifications change.

How it works

Stored on profile; server sends notifications in that language.

API

PATCH /me.

Done when

Native-speaker review done; no cut text at 360 px.

W-14 Coupons
Field

Detail

Where

Admin web

Purpose

Run offers.

On the screen

Table + form: code, percent/flat, valid dates, total uses, per-user limit, city, plans; usage
report.

How it works

Validated at checkout and again at approval.

Checks and
errors

Code A–Z/0–9, 4–20 chars; unique.

API

/admin/coupons.

Security

Race-safe counting in transactions; audit log.

Done when

T7 passes.

W-15 ID verifications
Field

Detail

Where

Admin web (Super admin)

Purpose

Approve badges.

On the screen

Queue with ID image (signed link), lister info, Approve/Reject with reason.

API

/admin/id-verifications.

Security

Super admin only; views logged; images deleted on schedule.

Done when

ADMIN gets 403.

W-16 Insights
Field

Detail

Where

Admin web

Purpose

Grow with data.

On the screen

Top searches, zero-result searches, category and city charts, plan revenue, CSV export.

API

GET /admin/insights.

Security

No personal data in exports.

Done when

Numbers match test data.

## 30. Phase 6 — Hardening and public launch

ID

Task

Details and acceptance

P6-01

Full security review

Run 7.4 on the whole repository; fix all Critical/High; document
Medium/Low with a plan.

P6-02

External check
(recommended)

Ask an independent security tester or a second developer to try T1–T24
and their own attacks for one day.

P6-03

ZAP + MobSF +
dependency audit

Latest scans clean of High findings.

P6-04

Load test

k6: 300 virtual users browsing and searching for 15 min; p95 API < 400
ms; no errors except expected 429s.

P6-05

Backup restore drill

Restore last night's backup to a fresh server; app works against it.

P6-06

Incident drill

Simulate a leaked key: rotate, redeploy, confirm old key fails — within 1
hour.

P6-07

Tester feedback closed

All P1/P2 tester issues fixed and verified.

P6-08

Production access

Apply in Play Console (personal account) with real testing details, or
promote directly (organization account).

P6-09

Staged rollout

20% → 50% → 100% over 3–7 days, watching crash-free users (≥
99.5%) and error rates.

P6-10

Launch operations

Admin team trained (payment checks twice a day, report handling);
support WhatsApp/email live; first city opened.

GATE — all must pass before the next phase
☐ No open Critical/High security findings anywhere
☐ Load test and restore drill passed
☐ Crash-free users ≥ 99.5% in closed testing for the last 7 days
☐ Daman Singh approves the launch
☐ Production access granted and rollout started

## 31. Phase 7 — Run and maintain

Frequency

Task

Daily

Check payment queue (target < 4 working hours), reports, error alerts, uptime

Weekly

Review crash reports, slow endpoints, zero-result searches; small fixes release

Monthly

Dependency updates + full test run; security scans; restore test; cost review; check Google
Play policy emails

Every 6 months

Rotate secrets and keys; review admin accounts and roles; review retention deletions

Yearly

Raise target API level when Google requires (usually every August); renew domain; full
security review

Release routine for every update

Card done

Staging deploy

Smoke test

Internal track

gate passed

auto

15 min

then closed

100% or rollback

Watch 24 h
crashes, errors

Rollout 20%

Production deploy
manual + tag

Same steps every time

## 32. Handover to Daman Singh

#

Item

How

1

GitHub repository

Already in company org; developer remains collaborator for maintenance

2

All accounts

Already company-owned (section 4); confirm owners and remove unneeded
access

3

Secrets

Shared vault in password manager; after handover, company rotates all
passwords and keys

4

Upload keystore

In vault + offline backup; Play App Signing keeps the app key safe at Google

5

Documentation

HANDOVER.md: deploy, rollback, backup/restore, add admin, change UPI ID,
release an update, renew certificates, costs list

6

Admin training

1-hour recorded session for the admin team

7

Maintenance
agreement

Separate monthly support contract (scope, response time)

## 33. Later list (not now)

These ideas are deliberately left out of this build. They will be discussed after launch, using
real user data.
Idea

Why later

In-app chat

WhatsApp already works; chat needs moderation and storage

Automatic payment gateway

Add when payments exceed ~30 per day

Ratings and reviews

Need real completed rentals first

Booking / availability calendar

Needs user habits data

Saved-search alerts

After search data shows demand

Seeker website (SEO)

After app traction

iPhone app

After Android is stable (same Flutter code)

Digital handover checklist /
agreements

After dispute patterns are known

Delivery, insurance, deposit holding

Need partners and legal review

More languages

After Hindi results

Appendix A — API endpoints
Area

Endpoints

Access

Auth

POST /auth/firebase · POST /auth/refresh · POST /auth/logout

Public (App Check)

Me

GET/PATCH /me · POST /me/delete-request · GET /me/consents

User

Catalogue

GET /cities · POST /cities/:id/waitlist · GET /categories · GET
/settings/public

Public / User

Uploads

POST /uploads/sign (purpose: listing | proof | id | logo)

User

Listings

GET /listings · GET /listings/:id · POST /listings · PATCH/DELETE
/listings/:id · POST /listings/:id/status

Public read / Owner
write

Contact

POST /listings/:id/contact

User (App Check,
limited)

Engagement

POST/DELETE /favorites/:listingId · GET /favorites · POST /reports ·
POST/DELETE /blocks/:userId

User

Requests

POST /requests · GET /requests/mine

User

Plans

GET /plans · POST /subscriptions · GET /subscriptions/mine · POST
/coupons/validate

User

Payments

POST /payments/:id/proof · GET /payments/mine

User

Boosts

POST /listings/:id/boost

Owner

Referral

GET /referral · POST /referral/apply

User

Notifications

GET /notifications · POST /notifications/read · POST /devices · DELETE
/devices/:token

User

Shop

GET /shops/:id · PUT /shops/me

Public / Owner

Public pages

/privacy · /terms · /delete-account · /i/:shortId ·
/.well-known/assetlinks.json

Public

Admin

/admin/auth/* · /admin/dashboard · /admin/payments · /admin/plans ·
/admin/coupons · /admin/listings · /admin/reports · /admin/users ·
/admin/cities · /admin/categories · /admin/push · /admin/insights ·
/admin/settings · /admin/id-verifications · /admin/audit

ADMIN /
SUPER_ADMIN

Appendix B — Environment variables
Name

Purpose

NODE_ENV, PORT, APP_BASE_URL,
PUBLIC_WEB_URL, ADMIN_ORIGIN

Basic settings and allowed admin origin for CORS

DATABASE_URL

PostgreSQL connection (app user, not superuser)

REDIS_URL

Redis connection with password

JWT_ACCESS_SECRET, JWT_ISSUER,
JWT_AUDIENCE

Signing our access tokens (random 64+ bytes)

REFRESH_TOKEN_PEPPER

Extra secret for hashing refresh tokens

FIREBASE_PROJECT_ID,
FIREBASE_SERVICE_ACCOUNT_JSON

Verifying Firebase tokens, App Check and sending push

APP_CHECK_ENFORCE

true in production

STORAGE_ENDPOINT, STORAGE_REGION,
STORAGE_KEY, STORAGE_SECRET

Object storage access (scoped keys)

BUCKET_PHOTOS, BUCKET_PRIVATE_DOCS

Bucket names

ADMIN_SESSION_SECRET, CSRF_SECRET

Admin session and CSRF protection

SENTRY_DSN_BACKEND

Error tracking

RATE_LIMIT_*

Default limits (can be overridden in Settings)

Real values exist only on the servers and in the password manager. The repository contains only
.env.example with dummy values.

Appendix C — Data safety form answers (draft)
Data type

Collect
ed

Shared

Purpose

Optional?

Phone number

Yes

Shown to other users only when
they tap WhatsApp on your listing

Account,
communication

Required

Name

Yes

First name shown on listings

Account

Required

Approximate
location

Yes

Area only, shown on listings

App functionality

Optional
(Near me)

Photos

Yes

Listing photos are public

App functionality

Required for
listers

Payment proof (UTR,
screenshot)

Yes

No

Purchases verification

Required for
paid plans

ID document photo

Yes

No

Fraud prevention
(badge)

Optional

Device or other IDs
(push token, device
id)

Yes

No

Notifications, fraud
prevention

Required

Crash logs and
diagnostics

Yes

No

App stability

Required

App interactions
(views, searches)

Yes

No

Analytics (aggregated)

Required

Also declare: data encrypted in transit (yes); users can request deletion (yes, in app and at the
web link); no data sold. Final answers must match the real build.

Appendix D — Test phones and glossary
Test phones (minimum)
Type

Example

Why

Low-end Android 8–10, 2–3 GB
RAM

Any budget phone

Speed and memory issues

Mid-range Android 13–14

Popular mid-range phone

Most common users

Latest Android with 16 KB pages
enabled (emulator)

Android 15+ emulator

Play requirement

Small screen 360 × 800

Emulator

Layout overflow

Phone with Hindi system language

Any

Hindi layouts

Glossary
Term

Meaning

BOLA / IDOR

Getting someone else's data by changing an id in the request

Mass assignment

Sending extra fields (like status or role) that the server wrongly accepts

XSS

Injecting a script into a page that runs in someone else's browser

CSRF

Tricking a logged-in admin's browser into doing an action

Rate limit

Maximum number of requests allowed in a time window

App Check / Play Integrity

Google services that prove a request comes from the genuine app on a genuine
device

SMS pumping

Fraud where bots request OTP SMS to make you pay for them

Obfuscation

Scrambling app code names so it is hard to read

Idempotency key

A unique key that makes repeating the same request safe

Transaction / row lock

Database tools that stop two requests changing the same thing at once

Signed URL

A temporary private link to a file that expires after minutes

Audit log

A record of every admin action that cannot be edited

Staging

Test copy of the system with fake data

