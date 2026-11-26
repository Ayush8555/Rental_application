import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin } from '../../plugins/admin-session.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import { Prisma } from '../../services/db.ts';
import { idParams } from './common.ts';

const couponBody = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/, 'Use 4–20 letters or numbers'),
    type: z.enum(['PERCENT', 'FLAT']),
    value: z.number().int().min(1),
    validFrom: z.iso.datetime(),
    validTo: z.iso.datetime(),
    maxUses: z.number().int().min(1).max(1_000_000).nullable(),
    perUserLimit: z.number().int().min(1).max(100).default(1),
    cityId: z.uuid().nullable().optional(),
    planIds: z.array(z.uuid()).max(50).default([]),
    isActive: z.boolean().default(true),
  })
  .strict();

function check(c: z.infer<typeof couponBody>) {
  if (c.type === 'PERCENT' && c.value > 90) throw badRequest('Percent coupons can be at most 90%', 'BAD_VALUE');
  if (c.type === 'FLAT' && c.value % 100 !== 0) throw badRequest('Use whole rupees', 'BAD_VALUE');
  if (new Date(c.validFrom) >= new Date(c.validTo)) throw badRequest('End date must be after start date', 'BAD_DATES');
}

export default async function adminCouponRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/admin/coupons', { preHandler: requireAdmin }, async () => {
    const items = await deps.db.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    const revenue = await deps.db.payment.groupBy({ by: ['couponId'], where: { status: 'APPROVED', couponId: { not: null } }, _sum: { amountPaise: true, discountPaise: true } });
    const r = new Map(revenue.map((x) => [x.couponId, x._sum]));
    return { items: items.map((c) => ({ ...c, revenuePaise: r.get(c.id)?.amountPaise ?? 0, discountGivenPaise: r.get(c.id)?.discountPaise ?? 0 })) };
  });

  app.post('/admin/coupons', { preHandler: requireAdmin }, async (req) => {
    const body = parse(couponBody, req.body);
    check(body);
    try {
      const c = await deps.db.coupon.create({ data: { ...body, cityId: body.cityId ?? null, validFrom: new Date(body.validFrom), validTo: new Date(body.validTo) } });
      await audit(deps.db, actorOf(req), 'coupon.create', 'Coupon', c.id, null, c);
      return c;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict('This code already exists', 'DUPLICATE');
      throw e;
    }
  });

  app.put('/admin/coupons/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(couponBody, req.body);
    check(body);
    const before = await deps.db.coupon.findUnique({ where: { id } });
    if (!before) throw notFound();
    if (before.usedCount > 0 && before.code !== body.code) throw badRequest('A used coupon cannot be renamed', 'IN_USE');
    const after = await deps.db.coupon.update({ where: { id }, data: { ...body, cityId: body.cityId ?? null, validFrom: new Date(body.validFrom), validTo: new Date(body.validTo) } });
    await audit(deps.db, actorOf(req), 'coupon.update', 'Coupon', id, before, after);
    return after;
  });
}
