// Seed data for local and staging only (P0-15). Never run on production.
// Names, areas and prices are what you would actually see on a local rental
// group, not generated filler.
//
//   npm run db:seed

import { createDb } from '../src/services/db.ts';
import { newReferralCode, newShortId } from '../src/lib/ids.ts';
import { roundCoord } from '../src/lib/geo.ts';
import { addDays } from '../src/lib/time.ts';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL!);

const cities = [
  { name: 'Lucknow', nameHi: 'लखनऊ', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462, isOpen: true },
  { name: 'Jaipur', nameHi: 'जयपुर', state: 'Rajasthan', lat: 26.9124, lng: 75.7873, isOpen: true },
  { name: 'Indore', nameHi: 'इंदौर', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577, isOpen: true },
  { name: 'Pune', nameHi: 'पुणे', state: 'Maharashtra', lat: 18.5204, lng: 73.8567, isOpen: false },
  { name: 'Chandigarh', nameHi: 'चंडीगढ़', state: 'Chandigarh', lat: 30.7333, lng: 76.7794, isOpen: false },
];

const areas: Record<string, Array<[string, number, number]>> = {
  Lucknow: [
    ['Gomti Nagar', 26.8506, 81.0012],
    ['Hazratganj', 26.8505, 80.9461],
    ['Aliganj', 26.8936, 80.9385],
    ['Indira Nagar', 26.8724, 80.9894],
    ['Aashiana', 26.7856, 80.9096],
  ],
  Jaipur: [
    ['Malviya Nagar', 26.8549, 75.8243],
    ['Vaishali Nagar', 26.9124, 75.7406],
    ['Mansarovar', 26.8505, 75.7628],
    ['C-Scheme', 26.9056, 75.8014],
  ],
  Indore: [
    ['Vijay Nagar', 22.7533, 75.8937],
    ['Palasia', 22.7244, 75.8839],
    ['Rau', 22.6366, 75.8120],
  ],
};

const categories = [
  { name: 'Electronics', nameHi: 'इलेक्ट्रॉनिक्स', icon: 'device-mobile', sortOrder: 1, fieldsSchema: [{ key: 'brand', label: 'Brand', type: 'text' }] },
  {
    name: 'Cameras',
    nameHi: 'कैमरा',
    icon: 'camera',
    sortOrder: 2,
    fieldsSchema: [
      { key: 'brand', label: 'Brand', type: 'select', options: ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'GoPro', 'Other'] },
      { key: 'lens', label: 'Lens included', type: 'text' },
    ],
  },
  { name: 'Furniture', nameHi: 'फ़र्नीचर', icon: 'armchair', sortOrder: 3, fieldsSchema: [] },
  { name: 'Tools', nameHi: 'औज़ार', icon: 'wrench', sortOrder: 4, fieldsSchema: [] },
  {
    name: 'Vehicles',
    nameHi: 'गाड़ियाँ',
    icon: 'moped',
    sortOrder: 5,
    fieldsSchema: [
      { key: 'model', label: 'Model', type: 'text', required: true },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'fuel', label: 'Fuel', type: 'select', options: ['Petrol', 'Electric', 'CNG', 'Diesel'] },
    ],
  },
  { name: 'Party & events', nameHi: 'पार्टी और इवेंट', icon: 'confetti', sortOrder: 6, fieldsSchema: [] },
];

const listers = [
  ['Rahul Srivastava', 'Lucknow'],
  ['Neha Agarwal', 'Lucknow'],
  ['Mohd. Faizan', 'Lucknow'],
  ['Pooja Sharma', 'Jaipur'],
  ['Vikram Singh Rathore', 'Jaipur'],
  ['Anjali Meena', 'Jaipur'],
  ['Saurabh Jain', 'Indore'],
  ['Ritu Patidar', 'Indore'],
] as const;

type Row = [lister: number, area: string, category: string, title: string, desc: string, day: number | null, week: number | null, month: number | null, deposit: number | null, condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR'];

// prices in rupees
const rows: Row[] = [
  [0, 'Gomti Nagar', 'Cameras', 'Canon 1500D with 18-55mm lens', 'Used for a few weddings, works perfectly. Comes with bag, 32GB card and two batteries. ID proof needed at pickup.', 450, 2500, null, 5000, 'GOOD'],
  [0, 'Gomti Nagar', 'Tools', 'Bosch drill machine with bits', 'GSB 500W impact drill. Full bit set for wall, wood and metal. Good for fitting curtains and TV mounts.', 150, 700, null, 1000, 'GOOD'],
  [0, 'Gomti Nagar', 'Electronics', 'JBL PartyBox 110 speaker', 'Loud and clear, battery lasts 10-12 hours. Mic input works. Perfect for terrace parties.', 600, null, null, 3000, 'LIKE_NEW'],
  [1, 'Hazratganj', 'Furniture', 'Three seater sofa, grey fabric', 'Comfortable sofa, no stains. Good for people who just shifted and do not want to buy yet. Pickup from Hazratganj.', null, null, 1200, 3000, 'GOOD'],
  [1, 'Hazratganj', 'Party & events', 'Fairy lights set, 20 strings', 'Warm white LED strings, 10m each. We used them for Diwali and a mehendi. Extension board included.', 300, 1500, null, 500, 'GOOD'],
  [1, 'Aliganj', 'Furniture', 'Study table with chair', 'Wooden study table, 4 ft, with a revolving chair. Ideal for students preparing for exams.', null, null, 700, 1500, 'GOOD'],
  [2, 'Aliganj', 'Vehicles', 'Honda Activa 6G for daily use', 'Well maintained, 2022 model. Helmet given. Valid licence must be shown. Fuel at your cost.', 400, 2200, 7000, 5000, 'GOOD'],
  [2, 'Indira Nagar', 'Tools', 'Ladder, 8 feet aluminium', 'Folding aluminium ladder, very stable. Useful for painting, cleaning fans and fixing lights.', 100, 400, null, 500, 'GOOD'],
  [2, 'Indira Nagar', 'Electronics', 'Epson projector for movie nights', 'Full HD projector with HDMI cable. Screen not included, works fine on a white wall.', 700, 3500, null, 6000, 'LIKE_NEW'],
  [2, 'Aashiana', 'Party & events', 'Gas tandoor for functions', 'Big commercial tandoor, runs on LPG. Good for 50-100 people. You will need to arrange the cylinder.', 900, null, null, 4000, 'GOOD'],
  [0, 'Aashiana', 'Cameras', 'GoPro Hero 9 with mounts', 'Helmet mount, chest strap and waterproof case. Good for Manali or Rishikesh trips.', 500, 2800, null, 6000, 'GOOD'],
  [1, 'Gomti Nagar', 'Electronics', 'Samsung 7kg washing machine', 'Fully automatic front load. Good for students and bachelors for a few months. Delivery can be arranged.', null, null, 1100, 3000, 'GOOD'],
  [2, 'Hazratganj', 'Furniture', 'Single bed with mattress', 'Engineered wood single bed with 5 inch mattress. Clean and sturdy.', null, null, 900, 2000, 'GOOD'],
  [3, 'Malviya Nagar', 'Cameras', 'Sony A7 III body only', 'Full frame mirrorless, shutter count around 30k. For experienced users only. Original charger.', 1500, 8000, null, 30000, 'LIKE_NEW'],
  [3, 'Malviya Nagar', 'Cameras', 'Godox SL60 light with softbox', 'Continuous LED light with 80cm softbox and stand. Good for YouTube and product shoots.', 400, 2000, null, 3000, 'GOOD'],
  [3, 'C-Scheme', 'Party & events', 'Wedding safa set for groom side', 'Set of 25 Rajasthani safas in rani pink and orange. Cleaned after every use.', 1200, null, null, 3000, 'GOOD'],
  [4, 'Vaishali Nagar', 'Vehicles', 'Royal Enfield Classic 350', 'BS6 model, serviced last month. Good for weekend rides to Nahargarh. Licence and ID required.', 1000, 5500, null, 10000, 'GOOD'],
  [4, 'Vaishali Nagar', 'Tools', 'Pressure washer for car and bike', 'Karcher K2, cleans car in 15 minutes. Hose and foam bottle included.', 250, 1200, null, 2000, 'LIKE_NEW'],
  [4, 'Mansarovar', 'Electronics', 'PS5 with two controllers', 'Disc edition with FIFA and Spider-Man. Return in the same condition please.', 600, 3500, null, 10000, 'LIKE_NEW'],
  [5, 'Mansarovar', 'Furniture', 'Plastic chairs, set of 20', 'White Supreme chairs for events or puja at home. Pickup from Mansarovar.', 250, null, null, 1000, 'GOOD'],
  [5, 'Mansarovar', 'Party & events', 'Dhol and dandiya sticks', 'Proper Punjabi dhol plus 20 pairs of decorated dandiya sticks. Navratri special.', 500, null, null, 2000, 'GOOD'],
  [5, 'C-Scheme', 'Electronics', 'Dell laptop i5 for exams and work', 'Inspiron 15, 8GB RAM, 512GB SSD. Fresh Windows, MS Office installed. Charger included.', 350, 2000, 6000, 8000, 'GOOD'],
  [3, 'Vaishali Nagar', 'Furniture', 'Office desk and ergonomic chair', 'L-shaped desk and a mesh chair. For work from home setups. Delivery within Jaipur at extra cost.', null, null, 1500, 3000, 'LIKE_NEW'],
  [4, 'Malviya Nagar', 'Tools', 'Tile cutter, 24 inch', 'Manual tile cutter, cuts clean straight lines. Spare wheel included.', 200, 900, null, 1500, 'GOOD'],
  [6, 'Vijay Nagar', 'Electronics', 'Mi 43 inch smart TV', 'Android TV with remote and wall mount. Good for a PG room or a match night.', null, 1500, 3500, 5000, 'GOOD'],
  [6, 'Vijay Nagar', 'Vehicles', 'Ather 450X electric scooter', 'Charger included, range around 90 km. Charging at your place. Only for Indore city use.', 600, 3200, null, 8000, 'LIKE_NEW'],
  [6, 'Palasia', 'Cameras', 'Nikon D7500 with 50mm f/1.8', 'Great for portraits and events. Two batteries, 64GB card. Pickup in Palasia.', 700, 4000, null, 12000, 'GOOD'],
  [7, 'Palasia', 'Party & events', 'Birthday decoration kit', 'Balloon arch stand, backdrop frame, neon "Happy Birthday" sign and table cloths.', 700, null, null, 1500, 'GOOD'],
  [7, 'Rau', 'Tools', 'Grass cutter, petrol', 'For farmhouse and big lawns. Fuel not included. We will show you how to start it.', 400, 2000, null, 3000, 'FAIR'],
  [7, 'Rau', 'Furniture', 'Wooden dining table, 6 seater', 'Sheesham wood table with six chairs. Suitable for a family staying for a few months.', null, null, 1800, 4000, 'GOOD'],
  [6, 'Rau', 'Electronics', 'Inverter with battery', 'Luminous 900VA with a 150Ah tubular battery. Good backup for summer power cuts.', null, null, 1000, 4000, 'GOOD'],
  [7, 'Vijay Nagar', 'Cameras', 'DJI Mini 3 drone', 'Flies very stable. Only for open areas and with permission. Two batteries.', 1500, null, null, 15000, 'LIKE_NEW'],
  [0, 'Indira Nagar', 'Party & events', 'Sound system with two mics', 'Ahuja amplifier, two speakers and two wireless mics. For jagran, small functions and school events.', 1500, null, null, 5000, 'GOOD'],
  [1, 'Aliganj', 'Electronics', 'Air cooler, 70 litre desert', 'Symphony desert cooler, cools a big hall. Wheels for easy moving.', null, 800, 2000, 2000, 'GOOD'],
  [2, 'Gomti Nagar', 'Vehicles', 'Hero cycle for kids, 20 inch', 'For children 8 to 12 years. Training wheels can be added.', 60, 300, 900, 500, 'GOOD'],
  [3, 'C-Scheme', 'Electronics', 'iPad 9th gen with pencil', 'Good for drawing and online classes. Screen guard on, comes in a cover.', 300, 1800, null, 8000, 'LIKE_NEW'],
  [4, 'Mansarovar', 'Furniture', 'Baby cot with mattress', 'Wooden cot with side rails, mattress cover washed. Useful when relatives visit with a baby.', null, 500, 1500, 1500, 'GOOD'],
  [5, 'Vaishali Nagar', 'Tools', 'Welding machine, inverter type', 'ARC 200 welding machine with holder and earthing clamp. Only for people who know welding.', 400, 2000, null, 4000, 'GOOD'],
  [6, 'Palasia', 'Furniture', 'Bean bag XXL, filled', 'Leather look bean bag with beans filled. Very comfortable for gaming.', null, 300, 700, 800, 'GOOD'],
  [7, 'Palasia', 'Electronics', 'Canon printer, colour', 'Pixma G3010 ink tank, prints and scans. Good for wedding cards and assignments.', 150, 700, 1800, 2000, 'GOOD'],
];

async function main() {
  const existing = await db.city.count();
  if (existing > 0) {
    console.log('Database already has data. Skipping seed.');
    return;
  }

  const cityIds = new Map<string, string>();
  for (const c of cities) {
    const row = await db.city.create({
      data: { ...c, slug: `${c.name.toLowerCase()}-${c.state.toLowerCase().replace(/\s+/g, '-')}`, openedAt: c.isOpen ? new Date() : null },
    });
    cityIds.set(c.name, row.id);
  }

  const areaIds = new Map<string, { id: string; cityId: string; lat: number; lng: number }>();
  for (const [city, list] of Object.entries(areas)) {
    for (const [name, lat, lng] of list) {
      const a = await db.area.create({ data: { cityId: cityIds.get(city)!, name, lat, lng } });
      areaIds.set(name, { id: a.id, cityId: a.cityId, lat, lng });
    }
  }

  const catIds = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.create({ data: c });
    catIds.set(c.name, row.id);
  }

  const plans = await Promise.all([
    db.plan.create({
      data: {
        name: 'Free trial', nameHi: 'फ़्री ट्रायल', type: 'TRIAL', pricePaise: 0, durationDays: 15, listingLimit: 1, maxPerUser: 1, sortOrder: 0,
        badge: 'New listers', badgeHi: 'नए लिस्टर', points: ['1 item live for 15 days', 'No payment needed'], pointsHi: ['15 दिन तक 1 सामान', 'कोई पेमेंट नहीं'],
      },
    }),
    db.plan.create({
      data: {
        name: 'Monthly', nameHi: 'मासिक', type: 'PAID', pricePaise: 29900, durationDays: 30, listingLimit: 5, sortOrder: 1,
        points: ['Up to 5 items live', 'See views and WhatsApp chats'], pointsHi: ['5 सामान तक', 'व्यू और WhatsApp चैट देखें'],
      },
    }),
    db.plan.create({
      data: {
        name: 'Quarterly', nameHi: 'तीन महीने', type: 'PAID', pricePaise: 79900, durationDays: 90, listingLimit: 15, sortOrder: 2,
        badge: 'Popular', badgeHi: 'लोकप्रिय', points: ['Up to 15 items live', 'Save ₹98 over monthly'], pointsHi: ['15 सामान तक', 'मासिक से ₹98 की बचत'],
      },
    }),
    db.plan.create({
      data: {
        name: 'Business', nameHi: 'बिज़नेस', type: 'BUSINESS', pricePaise: 199900, durationDays: 90, listingLimit: null, boostCredits: 2, shopPage: true, sortOrder: 3,
        badge: 'For shops', badgeHi: 'दुकानों के लिए', points: ['Unlimited items', 'Your own shop page', '2 free boosts every month'], pointsHi: ['असीमित सामान', 'अपना शॉप पेज', 'हर महीने 2 फ़्री बूस्ट'],
      },
    }),
  ]);

  const userIds: string[] = [];
  for (const [i, [name, city]] of listers.entries()) {
    const u = await db.user.create({
      data: {
        // 90000 000xx: reserved fake range, never a real subscriber
        phone: `+9190000000${String(i + 10).padStart(2, '0')}`,
        name,
        cityId: cityIds.get(city)!,
        isLister: true,
        referralCode: newReferralCode(),
        createdAt: addDays(new Date(), -(30 + i * 9)),
      },
    });
    userIds.push(u.id);
    await db.subscription.create({
      data: {
        userId: u.id, planId: plans[2].id, planName: plans[2].name, planNameHi: plans[2].nameHi, planType: 'PAID', pricePaise: plans[2].pricePaise,
        durationDays: 90, listingLimit: 15, boostCredits: 0, shopPage: false, status: 'ACTIVE', startsAt: addDays(new Date(), -10), endsAt: addDays(new Date(), 80), source: 'admin',
        assignReason: 'seed data',
      },
    });
  }

  for (const [i, r] of rows.entries()) {
    const [lister, areaName, cat, title, description, day, week, month, deposit, condition] = r;
    const area = areaIds.get(areaName)!;
    const prices = [day, week, month].filter((p): p is number => p !== null);
    await db.listing.create({
      data: {
        shortId: newShortId(),
        userId: userIds[lister]!,
        cityId: area.cityId,
        areaId: area.id,
        categoryId: catIds.get(cat)!,
        title,
        description,
        rentDayPaise: day ? day * 100 : null,
        rentWeekPaise: week ? week * 100 : null,
        rentMonthPaise: month ? month * 100 : null,
        minRentPaise: Math.min(...prices) * 100,
        depositPaise: deposit ? deposit * 100 : null,
        condition,
        status: 'LIVE',
        approxLat: roundCoord(area.lat),
        approxLng: roundCoord(area.lng),
        publishedAt: new Date(Date.now() - i * 3_600_000 * 7),
        viewCount: (i * 37) % 120,
        waClickCount: (i * 11) % 19,
      },
    });
  }

  console.log(`Seeded ${cities.length} cities, ${areaIds.size} areas, ${categories.length} categories, ${plans.length} plans, ${rows.length} listings.`);
  console.log('Sample lister for dev sign-in: dev:+919000000010');
}

await main();
await db.$disconnect();
