# Security review

Reviewed against OWASP API Top 10 (2023), OWASP Top 10 (2025), OWASP Mobile Top 10 (2024),
MASVS and BUILD_PLAN sections 15–22. This is a record of what was checked and what is left;
it is not a claim that the system is "secure".

## Review 1 — 27 Nov 2026 (phases 1–5, whole repo)

### Found and fixed in this review
| Severity | Where | Issue | Fix |
|---|---|---|---|
| Medium | listings search log | A phone number typed into search would have been stored in SearchLog (insights must have no personal data) | Digit runs of 5+ replaced before logging; test added in `listings.test.ts` |

### Protections checked (each has a test that fails if it breaks)
| Area | What could go wrong | What stops it |
|---|---|---|
| Payment approval | Double click or two admins approve together | Row lock + status check + idempotency key; 4 parallel approvals give 1 subscription |
| Coupons | Parallel approvals use a coupon past `maxUses` | Coupon row locked and counted inside the approval transaction; 5 parallel → 2 uses |
| Free offers | Two taps, second account on the same phone, reinstall | Advisory lock, limit per account and per device id |
| Refresh tokens | Stolen token replayed; two refreshes race | Rotation with reuse detection (revokes all sessions); conditional update for the race |
| Admin 2-step | Code replayed inside its 30 s window | Used codes remembered for 90 s |
| Uploads | Bigger file than declared on S3 | `Content-Length` is part of the presigned signature |
| UTR | Rejected UTR reused by another account | Every UTR kept forever in `UtrAttempt` |

### Attack list (section 22) — automated in `backend/test`
T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13 (stored text is stripped; admin renders text
only and lint forbids `dangerouslySetInnerHTML`), T14, T15, T16, T17, T18, T20 (with enforcement on),
T21, T22. T19, T23, T24 need the release APK and real servers.

### Remaining risks (owner: Vimal Tiwari)
| Severity | Risk | Plan |
|---|---|---|
| Medium | `TRUST_PROXY=true` trusts any X-Forwarded-For. Safe only while the API is reachable through Caddy alone (current compose setup). | Before launch set Fastify `trustProxy` to Caddy's network address. |
| Medium | Admin step-up counts the login code for the first 5 minutes after sign-in. | Acceptable; revisit if the team grows. |
| Medium | A lister can enter any +91 number as the item's WhatsApp number. | Optional: OTP-verify a non-login WhatsApp number in Phase 6. |
| Low | Offset pagination lets a scraper read up to 2,000 rows per filter combination. | Rate limits + App Check; watch insights for abuse. |
| Low | Share card images are cached by listing `updatedAt` and kept until retention runs. | Add a lifecycle rule on `share/` in the photos bucket (30 days). |
| Info | Semgrep, ZAP, MobSF and k6 have not run against real staging yet. | Phase 4/6 gates. |
