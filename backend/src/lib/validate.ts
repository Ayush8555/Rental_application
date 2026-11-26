import type { z } from 'zod';
import { badRequest } from './errors.ts';

// Parses untrusted input. Schemas are expected to be .strict() so unknown
// fields (status, role, userId...) make the request fail instead of being
// silently passed through.
export function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input ?? {});
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const base = issue.path.join('.');
      if (issue.code === 'unrecognized_keys') {
        for (const k of issue.keys) fields[base ? `${base}.${k}` : k] = 'not allowed';
        continue;
      }
      const key = base || '_';
      fields[key] ??= issue.message;
    }
    throw badRequest('Please check the details and try again', 'VALIDATION', { fields });
  }
  return result.data;
}
