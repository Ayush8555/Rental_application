import type { Db } from './db.ts';
import type { Push } from './push.ts';

type Lang = 'en' | 'hi';
type Vars = Record<string, string | number>;

// Short, plain wording. Push bodies never carry phone numbers, UTRs or amounts
// beyond what the user already knows; details are in the app.
const templates: Record<string, Record<Lang, { title: string; body: string }>> = {
  PAYMENT_APPROVED: {
    en: { title: 'Payment confirmed', body: 'Your {what} is active now. Thanks!' },
    hi: { title: 'पेमेंट कन्फ़र्म हो गया', body: 'आपका {what} अब चालू है। धन्यवाद!' },
  },
  PAYMENT_REJECTED: {
    en: { title: 'We could not confirm your payment', body: '{reason}. Open the app to submit again.' },
    hi: { title: 'पेमेंट कन्फ़र्म नहीं हो पाया', body: '{reason}। दोबारा भेजने के लिए ऐप खोलें।' },
  },
  PLAN_ACTIVATED: {
    en: { title: 'Plan active', body: '{plan} is active till {date}.' },
    hi: { title: 'प्लान चालू', body: '{plan} {date} तक चालू है।' },
  },
  PLAN_PENDING_APPROVAL: {
    en: { title: 'Request received', body: 'We will activate {plan} after a quick check.' },
    hi: { title: 'रिक्वेस्ट मिल गई', body: 'जांच के बाद {plan} चालू कर दिया जाएगा।' },
  },
  PLAN_EXPIRING: {
    en: { title: 'Plan ends in {days} day(s)', body: 'Renew {plan} to keep your items live.' },
    hi: { title: 'प्लान {days} दिन में ख़त्म होगा', body: 'सामान चालू रखने के लिए {plan} रिन्यू करें।' },
  },
  PLAN_EXPIRED: {
    en: { title: 'Your plan has ended', body: 'Your items are hidden for now. Renew to show them again.' },
    hi: { title: 'आपका प्लान ख़त्म हो गया', body: 'आपका सामान अभी छिपा है। दोबारा दिखाने के लिए रिन्यू करें।' },
  },
  LISTING_APPROVED: {
    en: { title: 'Item is live', body: '"{title}" can now be seen by people in your city.' },
    hi: { title: 'सामान लाइव है', body: '"{title}" अब आपके शहर में दिख रहा है।' },
  },
  LISTING_REJECTED: {
    en: { title: 'Item needs changes', body: '"{title}": {reason}' },
    hi: { title: 'सामान में बदलाव ज़रूरी है', body: '"{title}": {reason}' },
  },
  LISTING_HIDDEN: {
    en: { title: 'Item hidden', body: '"{title}" is hidden while we take a look.' },
    hi: { title: 'सामान छिपाया गया', body: 'जांच पूरी होने तक "{title}" छिपा रहेगा।' },
  },
  BOOST_STARTED: {
    en: { title: 'Boost started', body: '"{title}" is in the Sponsored row till {date}.' },
    hi: { title: 'बूस्ट शुरू', body: '"{title}" {date} तक स्पॉन्सर्ड में दिखेगा।' },
  },
  CITY_OPENED: {
    en: { title: '{city} is open', body: 'RentNook is now live in {city}. Take a look around.' },
    hi: { title: '{city} शुरू हो गया', body: 'RentNook अब {city} में चालू है।' },
  },
  ITEM_REQUEST: {
    en: { title: 'Someone needs: {text}', body: 'A person near you is looking for this in {category}.' },
    hi: { title: 'किसी को चाहिए: {text}', body: '{category} में आपके पास कोई यह ढूंढ रहा है।' },
  },
  REFERRAL_REWARD: {
    en: { title: 'You earned {days} free days', body: 'Your friend joined and bought a plan. Days added.' },
    hi: { title: 'आपको {days} दिन मुफ़्त मिले', body: 'आपके दोस्त ने प्लान लिया। दिन जोड़ दिए गए।' },
  },
  ID_APPROVED: {
    en: { title: 'You are verified', body: 'The verified mark now shows on your items.' },
    hi: { title: 'आप वेरिफ़ाइड हैं', body: 'अब आपके सामान पर वेरिफ़ाइड निशान दिखेगा।' },
  },
  ID_REJECTED: {
    en: { title: 'ID not verified', body: '{reason}. You can try again.' },
    hi: { title: 'ID वेरिफ़ाई नहीं हुई', body: '{reason}। आप फिर से कोशिश कर सकते हैं।' },
  },
  ACCOUNT_DELETED: {
    en: { title: 'Account deletion started', body: 'Your items are hidden. Deletion finishes within 7 days.' },
    hi: { title: 'अकाउंट डिलीट शुरू', body: 'आपका सामान छिपा दिया गया है। 7 दिन में डिलीट पूरा होगा।' },
  },
};

const fill = (s: string, vars: Vars) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

export function render(type: string, lang: Lang, vars: Vars) {
  const t = templates[type]?.[lang] ?? templates[type]?.en;
  if (!t) throw new Error(`unknown notification type ${type}`);
  return { title: fill(t.title, vars).slice(0, 80), body: fill(t.body, vars).slice(0, 200) };
}

export class Notifier {
  constructor(
    private db: Db,
    private push: Push,
  ) {}

  async toUser(userId: string, type: string, vars: Vars, data: Record<string, string> = {}) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { language: true, status: true, deviceTokens: { select: { fcmToken: true } } },
    });
    if (!user || user.status === 'DELETED') return;
    const { title, body } = render(type, user.language, vars);
    await this.db.notification.create({ data: { userId, type, title, body, data } });
    await this.sendPush(
      user.deviceTokens.map((d) => d.fcmToken),
      { title, body, data: { type, ...data } },
    );
  }

  async sendPush(tokens: string[], msg: { title: string; body: string; data?: Record<string, string> }) {
    if (!tokens.length) return 0;
    try {
      const res = await this.push.send(tokens, msg);
      if (res.deadTokens.length) {
        await this.db.deviceToken.deleteMany({ where: { fcmToken: { in: res.deadTokens } } });
      }
      return res.sent;
    } catch {
      // Push is best effort; the in-app list already has the message.
      return 0;
    }
  }
}
