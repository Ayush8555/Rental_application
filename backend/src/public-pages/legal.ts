// Privacy Policy and Terms. Draft text written for review by the company
// before launch (P4-03). Company name, grievance officer and dates come from
// admin settings so they can be corrected without a deploy.

import { esc } from './html.ts';

export interface LegalVars {
  company: string;
  address: string;
  grievanceName: string;
  grievanceEmail: string;
  grievanceAddress: string;
  supportEmail: string | null;
  effectiveDate: string;
  privacyVersion: string;
  termsVersion: string;
  deleteUrl: string;
}

export function privacyHtml(v: LegalVars) {
  return `
<h1>Privacy Policy</h1>
<p class="muted">Version ${esc(v.privacyVersion)} · effective ${esc(v.effectiveDate)}</p>

<p>This policy explains what ${esc(v.company)} ("RentNook", "we") collects when you use the RentNook app and website,
why we need it, how long we keep it and how you can control it. We follow the Digital Personal Data Protection Act,
2023 and the DPDP Rules, 2025.</p>

<h2>1. What we collect</h2>
<table>
<tr><th>Data</th><th>Why</th><th>Who can see it</th></tr>
<tr><td>Mobile number</td><td>To sign you in with an OTP and to let people reach you on WhatsApp about your item</td><td>Only a signed-in person who taps "Chat on WhatsApp" on your item. It is never shown in lists or search.</td></tr>
<tr><td>Name</td><td>Shown on your items (first name only)</td><td>Everyone using the app</td></tr>
<tr><td>City and area</td><td>To show items near you and to place your items</td><td>Area name is shown on your items</td></tr>
<tr><td>Approximate location (optional)</td><td>Only when you tap "Near me", to sort by distance. Rounded to about 500 m and not stored.</td><td>No one</td></tr>
<tr><td>Item photos and text</td><td>To show your items</td><td>Everyone. Location data inside photos (EXIF/GPS) is removed when you upload.</td></tr>
<tr><td>Payment proof (UTR number, optional screenshot)</td><td>To check your plan payment against our bank statement</td><td>Our admin team only</td></tr>
<tr><td>ID photo (optional)</td><td>Only if you ask for the verified badge</td><td>Our Super admin only</td></tr>
<tr><td>Device data (push token, an app-specific device id)</td><td>To send notifications and to stop misuse of free offers</td><td>No one</td></tr>
<tr><td>Crash reports and usage counts</td><td>To fix bugs and to see which searches find nothing</td><td>Our team, in aggregate</td></tr>
</table>
<p>We do <strong>not</strong> collect Aadhaar or PAN numbers, date of birth, bank details, contacts, SMS or call logs.
Searches are logged without your user id.</p>

<h2>2. Consent</h2>
<p>When you sign up you tick a box agreeing to this policy. We store the version and time of that consent. You can
withdraw consent at any time by deleting your account (section 6). If we change this policy in a way that matters, the
app will ask you to accept the new version.</p>

<h2>3. Sharing</h2>
<p>We do not sell personal data. We use a few service providers who process data for us under contract:
Google Firebase (OTP sign-in, notifications, app integrity checks), our cloud hosting and storage provider in India,
and an error-tracking service (with personal data removed). We share data with authorities only when Indian law
requires it.</p>

<h2>4. Where and how we keep data</h2>
<p>Data is stored on servers in India. Connections use HTTPS. Payment proofs and ID photos are stored in a separate
private storage area and are opened only through short-lived links. Every admin action is recorded in an audit log.</p>

<h2>5. How long we keep it</h2>
<table>
<tr><th>Data</th><th>Kept for</th></tr>
<tr><td>Account and items</td><td>Until you delete your account (deletion completes within 7 days)</td></tr>
<tr><td>Payment records</td><td>As long as tax law requires, without your name or number after account deletion</td></tr>
<tr><td>Payment screenshots</td><td>180 days after the payment is checked</td></tr>
<tr><td>ID photos</td><td>30 days after the badge decision</td></tr>
<tr><td>Security and access logs</td><td>1 year</td></tr>
<tr><td>Search logs (no user id)</td><td>12 months</td></tr>
<tr><td>Backups</td><td>30 days rolling</td></tr>
</table>

<h2>6. Your rights</h2>
<ul class="plain">
<li>See and correct your name, city and language in the app (Profile).</li>
<li>Delete your account from the app (Profile → Delete my account) or on the web at
<a href="${esc(v.deleteUrl)}">${esc(v.deleteUrl)}</a>. Your items are hidden at once and the rest is removed within 7 days.</li>
<li>Ask us what data we hold about you, or raise a complaint, by writing to the Grievance Officer below.</li>
<li>You may nominate another person to exercise these rights for you in case of death or incapacity, by writing to us.</li>
</ul>

<h2>7. Children</h2>
<p>RentNook is for people aged 18 and above. We do not knowingly allow accounts for anyone younger.</p>

<h2>8. If something goes wrong</h2>
<p>If we find a breach that affects your data we will tell you without delay and inform the Data Protection Board of
India as the law requires.</p>

<h2>9. Grievance Officer</h2>
<p>${esc(v.grievanceName)}<br>
Email: <a href="mailto:${esc(v.grievanceEmail)}">${esc(v.grievanceEmail)}</a><br>
${esc(v.grievanceAddress)}</p>
<p>We acknowledge complaints within 48 hours and reply within the time allowed by law.</p>

<h2>10. Contact</h2>
<p>${esc(v.company)}, ${esc(v.address)}${v.supportEmail ? ` · <a href="mailto:${esc(v.supportEmail)}">${esc(v.supportEmail)}</a>` : ''}</p>

<h3>Changes to this policy</h3>
<ul class="plain"><li>${esc(v.privacyVersion)}: first version.</li></ul>
`;
}

export function termsHtml(v: LegalVars) {
  return `
<h1>Terms of Use</h1>
<p class="muted">Version ${esc(v.termsVersion)} · effective ${esc(v.effectiveDate)}</p>

<p>These terms are an agreement between you and ${esc(v.company)} ("RentNook", "we") for using the RentNook app and
website. By creating an account you accept them.</p>

<h2>1. What RentNook is</h2>
<p>RentNook is a listing service. People who want to give things on rent ("listers") post them; people looking for
things ("seekers") find them and talk to the lister on WhatsApp. <strong>RentNook is not a party to any rental.</strong>
We do not own, inspect, deliver or insure items, and we do not hold deposits. Rent, deposit, dates and condition are
agreed directly between the two people.</p>

<h2>2. Your account</h2>
<ul class="plain">
<li>You must be 18 or older and use your own Indian mobile number. One number, one account.</li>
<li>You are responsible for what happens under your account. Never share an OTP with anyone.</li>
<li>We may suspend or block accounts that break these terms, receive repeated genuine reports, or try to misuse offers.</li>
</ul>

<h2>3. Rules for listings</h2>
<ul class="plain">
<li>List only items you own or are allowed to rent out, with real photos and honest descriptions.</li>
<li>Do not put phone numbers, links or email addresses in the title or description. The app removes them.</li>
<li>These items are not allowed: weapons, drugs, medicines, alcohol, adult items, animals, fake or stolen goods,
government ID documents, and anything illegal in India.</li>
<li>We may review, hide or remove any listing. Items with several reports from different people are hidden until we check them.</li>
</ul>

<h2>4. Plans and payments</h2>
<ul class="plain">
<li>Searching and contacting listers is free. Listers need an active plan for their items to be visible.</li>
<li>Plans are paid by UPI directly to the company's UPI ID shown in the app. You then enter the UTR number so we can
match the payment with our bank statement. A plan starts when we confirm the payment.</li>
<li>Plan price, duration and item limit are shown before you pay. Changes to a plan never affect a plan you have
already bought.</li>
<li>If you buy a plan while one is running, the new plan starts when the current one ends. A bigger plan starts
immediately and your remaining days are added at the end.</li>
<li>When a plan ends your items are hidden (not deleted) and come back when you renew.</li>
<li><strong>Refunds:</strong> payments are not refundable once confirmed, except where we decide otherwise in a
specific case or where the law requires it. Payments we cannot match are rejected and you can submit again.</li>
<li>Free and trial offers are limited to once per person and phone. Using several accounts to get more is not allowed.</li>
<li>Boosts place an item in the Sponsored row for the days you choose. The number of sponsored items per city is
limited, so a boost may wait in a queue before it starts.</li>
</ul>

<h2>5. Safety</h2>
<p>Meet in a public place, check the item before paying, agree everything in writing on WhatsApp, and never pay an
advance to someone you have not met. Report anything suspicious from the item page.</p>

<h2>6. Liability</h2>
<p>We work to keep RentNook safe and available, but we provide it "as is". To the extent the law allows, RentNook is
not liable for any loss, damage, injury or dispute arising from a rental arranged through the app, including damage
to or loss of items and unreturned deposits. Our total liability to you for anything else is limited to the amount
you paid us in the three months before the claim.</p>

<h2>7. Ending your account</h2>
<p>You can delete your account at any time from the app or at <a href="${esc(v.deleteUrl)}">${esc(v.deleteUrl)}</a>.
Any running plan ends with it and is not refunded.</p>

<h2>8. Law and disputes</h2>
<p>These terms are governed by the laws of India. Please write to our Grievance Officer first
(<a href="mailto:${esc(v.grievanceEmail)}">${esc(v.grievanceEmail)}</a>); most issues are settled that way.</p>

<h3>Changes to these terms</h3>
<ul class="plain"><li>${esc(v.termsVersion)}: first version.</li></ul>
`;
}
