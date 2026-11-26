import { z } from 'zod';

export const pageQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(25),
};

export const paging = (q: { page: number; pageSize: number }) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });

export const idParams = z.object({ id: z.uuid() }).strict();

export const reason = z.string().trim().min(3, 'Add a short reason').max(300);
