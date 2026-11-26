import { z } from 'zod';
import type { Db } from './db.ts';

// Business settings editable from admin W-13. Defaults apply until an admin
// saves a value. The schema doubles as validation for the admin form.

export const settingSchemas = {
  upi: z
    .object({
      vpa: z.string().regex(/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{2,64}$/, 'Enter a valid UPI ID'),
      payeeName: z.string().min(2).max(60),
      qrKey: z.string().max(200).nullable(),
    })
    .strict(),
  support: z
    .object({
      whatsapp: z.string().regex(/^\+91[6-9]\d{9}$/).nullable(),
      email: z.email().nullable(),
      hours: z.string().max(80),
    })
    .strict(),
  grievance: z.object({ name: z.string().min(2).max(80), email: z.email(), address: z.string().max(300) }).strict(),
  company: z.object({ legalName: z.string().min(2).max(120), address: z.string().max(300) }).strict(),
  limits: z
    .object({
      contactsPerDay: z.number().int().min(1).max(500),
      reportsToHide: z.number().int().min(2).max(20),
      sponsoredPerCity: z.number().int().min(1).max(100),
      pendingPaymentsMax: z.number().int().min(1).max(10),
      utrPerDay: z.number().int().min(1).max(50),
      requestsPerDay: z.number().int().min(1).max(50),
      referralRewardsPerMonth: z.number().int().min(0).max(50),
      referralRewardDays: z.number().int().min(1).max(90),
      newAccountListingsFirstDay: z.number().int().min(1).max(50),
      broadcastsPerDay: z.number().int().min(1).max(10),
    })
    .strict(),
  moderation: z.object({ reviewNewItems: z.boolean() }).strict(),
  app: z
    .object({ minVersion: z.string().regex(/^\d+\.\d+\.\d+$/), latestVersion: z.string().regex(/^\d+\.\d+\.\d+$/) })
    .strict(),
  boostOptions: z
    .array(z.object({ days: z.number().int().min(1).max(60), pricePaise: z.number().int().min(100).max(10_000_000) }).strict())
    .min(1)
    .max(6),
  help: z
    .object({
      safetyTips: z.array(z.string().min(5).max(200)).max(10),
      safetyTipsHi: z.array(z.string().min(5).max(200)).max(10),
      faqs: z.array(z.object({ q: z.string().max(150), a: z.string().max(800) }).strict()).max(30),
      faqsHi: z.array(z.object({ q: z.string().max(150), a: z.string().max(800) }).strict()).max(30),
    })
    .strict(),
  legal: z
    .object({
      privacyVersion: z.string().max(20),
      termsVersion: z.string().max(20),
      effectiveDate: z.string().max(20),
    })
    .strict(),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

export const SUPER_ADMIN_ONLY_KEYS: SettingKey[] = ['upi', 'company', 'legal'];

export const defaults: { [K in SettingKey]: SettingValue<K> } = {
  upi: { vpa: 'rentnook@okaxis', payeeName: 'RentNook', qrKey: null },
  support: { whatsapp: null, email: 'support@example.in', hours: 'Mon–Sat, 10 am to 7 pm' },
  grievance: { name: 'Grievance Officer', email: 'grievance@example.in', address: 'To be updated' },
  company: { legalName: 'RentNook (working name)', address: 'To be updated' },
  limits: {
    contactsPerDay: 30,
    reportsToHide: 3,
    sponsoredPerCity: 10,
    pendingPaymentsMax: 3,
    utrPerDay: 10,
    requestsPerDay: 5,
    referralRewardsPerMonth: 5,
    referralRewardDays: 15,
    newAccountListingsFirstDay: 3,
    broadcastsPerDay: 3,
  },
  moderation: { reviewNewItems: false },
  app: { minVersion: '1.0.0', latestVersion: '1.0.0' },
  boostOptions: [
    { days: 3, pricePaise: 4900 },
    { days: 7, pricePaise: 9900 },
    { days: 15, pricePaise: 17900 },
  ],
  help: {
    safetyTips: [
      'Meet in a public place and check the item before you pay anything.',
      'Agree the deposit, rent and return date in writing on WhatsApp.',
      'Never share an OTP or pay an advance to someone you have not met.',
    ],
    safetyTipsHi: [
      'किसी सार्वजनिक जगह पर मिलें और पैसे देने से पहले सामान अच्छे से देख लें।',
      'डिपॉज़िट, किराया और लौटाने की तारीख़ WhatsApp पर लिखकर तय करें।',
      'किसी को OTP न बताएं और बिना मिले एडवांस न भेजें।',
    ],
    faqs: [
      {
        q: 'Is RentNook free for people looking for items?',
        a: 'Yes. Searching and contacting owners is free. Only people who put items on rent buy a plan.',
      },
      {
        q: 'Who decides the rent and deposit?',
        a: 'The owner and you agree it between yourselves on WhatsApp. RentNook does not take any commission.',
      },
      {
        q: 'How long does a plan payment take to confirm?',
        a: 'We check every UPI payment against our bank statement, usually within 4 working hours.',
      },
    ],
    faqsHi: [
      {
        q: 'क्या सामान ढूंढने वालों के लिए RentNook मुफ़्त है?',
        a: 'हाँ। सामान ढूंढना और मालिक से बात करना मुफ़्त है। सिर्फ़ किराये पर देने वाले प्लान लेते हैं।',
      },
      {
        q: 'किराया और डिपॉज़िट कौन तय करता है?',
        a: 'मालिक और आप WhatsApp पर आपस में तय करते हैं। RentNook कोई कमीशन नहीं लेता।',
      },
      {
        q: 'प्लान का पेमेंट कन्फ़र्म होने में कितना समय लगता है?',
        a: 'हम हर UPI पेमेंट को बैंक स्टेटमेंट से मिलाते हैं, आमतौर पर 4 कामकाजी घंटों में।',
      },
    ],
  },
  legal: { privacyVersion: '2026-11', termsVersion: '2026-11', effectiveDate: '2026-11-23' },
};

const CACHE_MS = 30_000;
let cache: { at: number; values: Partial<Record<SettingKey, unknown>> } | null = null;

export async function getSettings(db: Db): Promise<{ [K in SettingKey]: SettingValue<K> }> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const rows = await db.setting.findMany();
    const values: Partial<Record<SettingKey, unknown>> = {};
    for (const r of rows) {
      const schema = settingSchemas[r.key as SettingKey];
      if (!schema) continue;
      const parsed = schema.safeParse(r.value);
      if (parsed.success) values[r.key as SettingKey] = parsed.data;
    }
    cache = { at: Date.now(), values };
  }
  return { ...defaults, ...cache.values } as { [K in SettingKey]: SettingValue<K> };
}

export async function getSetting<K extends SettingKey>(db: Db, key: K): Promise<SettingValue<K>> {
  return (await getSettings(db))[key];
}

export function clearSettingsCache() {
  cache = null;
}
