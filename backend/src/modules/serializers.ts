// Explicit output shapes. Responses are built from these functions only, so
// a new column in the database never leaks to clients by accident.
// Phone numbers, exact coordinates, reporter identities and internal flags
// are deliberately absent.

import { maskPhone } from '../lib/phone.ts';
import { displayKm, distanceKm } from '../lib/geo.ts';
import type { Storage } from '../services/storage.ts';
import type { Area, Category, City, Listing, ListingImage, User } from '../services/db.ts';

export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0] || 'Owner';

export function serializeCity(c: City) {
  return { id: c.id, name: c.name, nameHi: c.nameHi, state: c.state, slug: c.slug, isOpen: c.isOpen };
}

export function serializeCategory(c: Category) {
  return { id: c.id, name: c.name, nameHi: c.nameHi, icon: c.icon, sortOrder: c.sortOrder, fields: c.fieldsSchema };
}

export function serializeMe(u: User & { city?: City | null }, consentRequired = false) {
  return {
    id: u.id,
    name: u.name,
    phoneMasked: maskPhone(u.phone),
    city: u.city ? serializeCity(u.city) : null,
    language: u.language,
    isLister: u.isLister,
    idVerified: u.idVerified,
    referralCode: u.referralCode,
    memberSince: u.createdAt.toISOString().slice(0, 7),
    consentRequired,
  };
}

const IMAGE_URL_TTL = 60 * 60;

export async function imageUrl(storage: Storage, key: string) {
  return storage.signGet('photos', key, IMAGE_URL_TTL);
}

type CardListing = Listing & {
  category: Category;
  area: Area;
  user: Pick<User, 'idVerified'>;
  images: ListingImage[];
};

export interface Origin {
  lat: number;
  lng: number;
}

export async function serializeCard(storage: Storage, l: CardListing, opts: { origin?: Origin | null; saved?: boolean } = {}) {
  const first = l.images[0];
  return {
    id: l.id,
    shortId: l.shortId,
    title: l.title,
    category: { id: l.category.id, name: l.category.name, nameHi: l.category.nameHi, icon: l.category.icon },
    area: { id: l.area.id, name: l.area.name },
    rentDayPaise: l.rentDayPaise,
    rentWeekPaise: l.rentWeekPaise,
    rentMonthPaise: l.rentMonthPaise,
    depositPaise: l.depositPaise,
    condition: l.condition,
    thumbnail: first ? await imageUrl(storage, first.storageKey) : null,
    distanceKm: opts.origin ? displayKm(distanceKm(opts.origin.lat, opts.origin.lng, l.approxLat, l.approxLng)) : null,
    verified: l.user.idVerified,
    sponsored: !!l.featuredUntil && l.featuredUntil > new Date(),
    saved: opts.saved ?? false,
    publishedAt: l.publishedAt?.toISOString() ?? null,
  };
}

type DetailListing = CardListing & {
  city: City;
  user: Pick<User, 'idVerified' | 'name' | 'createdAt' | 'id'> & { shop?: { shortId: string; shopName: string } | null };
};

export async function serializeDetail(storage: Storage, l: DetailListing, opts: { origin?: Origin | null; saved?: boolean; isOwner?: boolean } = {}) {
  const card = await serializeCard(storage, l, opts);
  return {
    ...card,
    description: l.description,
    extra: l.extra,
    city: serializeCity(l.city),
    images: await Promise.all(
      l.images.map(async (img) => ({ id: img.id, url: await imageUrl(storage, img.storageKey), width: img.width, height: img.height })),
    ),
    owner: {
      id: l.user.id,
      firstName: firstName(l.user.name),
      memberSince: l.user.createdAt.toISOString().slice(0, 7),
      verified: l.user.idVerified,
      shop: l.user.shop ? { id: l.user.shop.shortId, name: l.user.shop.shopName } : null,
    },
    isOwner: opts.isOwner ?? false,
  };
}

// The lister's own view of an item. Includes status and counts, still no phone.
export async function serializeOwnListing(storage: Storage, l: CardListing & { city: City }) {
  const card = await serializeCard(storage, l);
  return {
    ...card,
    description: l.description,
    extra: l.extra,
    cityId: l.cityId,
    categoryId: l.categoryId,
    areaId: l.areaId,
    status: l.status,
    hiddenReason: l.hiddenReason,
    rejectReason: l.rejectReason,
    usesAccountWhatsapp: !l.whatsappPhone,
    whatsappMasked: l.whatsappPhone ? maskPhone(l.whatsappPhone) : null,
    viewCount: l.viewCount,
    waClickCount: l.waClickCount,
    featuredUntil: l.featuredUntil?.toISOString() ?? null,
    images: await Promise.all(
      l.images.map(async (img) => ({ id: img.id, url: await imageUrl(storage, img.storageKey), width: img.width, height: img.height })),
    ),
    updatedAt: l.updatedAt.toISOString(),
  };
}

export const cardInclude = {
  category: true,
  area: true,
  user: { select: { idVerified: true } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
};
