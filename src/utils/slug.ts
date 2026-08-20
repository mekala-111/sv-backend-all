import slugify from "slugify";
import { nanoid } from "nanoid";
import { prisma } from "../config/prisma";

/**
 * Builds a unique, URL-safe event slug from the event name, e.g.
 * "Rahul Weds Priya" -> "rahul-weds-priya" (with a short suffix on collision).
 */
export async function generateUniqueEventSlug(eventName: string): Promise<string> {
  const base = slugify(eventName, { lower: true, strict: true }) || "event";
  let candidate = base;
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.event.findUnique({ where: { eventSlug: candidate } });
    if (!existing) return candidate;
    attempt += 1;
    candidate = `${base}-${nanoid(5).toLowerCase()}`;
    if (attempt > 10) {
      // Extremely unlikely, but guarantees termination.
      candidate = `${base}-${Date.now()}`;
    }
  }
}

export function generateCode(prefix: string): string {
  return `${prefix}-${nanoid(8).toUpperCase()}`;
}

export function buildPublicEventUrl(baseUrl: string, slug: string): string {
  return `${baseUrl.replace(/\/$/, "")}/${slug}`;
}
