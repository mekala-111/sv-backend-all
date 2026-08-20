import { Request, Response } from "express";
import { prisma } from "../../config/prisma";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { assertOwnsVendorRecord } from "../../middleware/tenantScope";

export async function listMedia(req: Request, res: Response) {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const media = await prisma.eventMedia.findMany({ where: { eventId: event.id }, orderBy: { sortOrder: "asc" } });
  return ok(res, media);
}

/** Registers an already-uploaded file (uploaded via a presigned S3 URL) against an event. */
export async function addMedia(req: Request, res: Response) {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const { type, fileUrl, thumbnailUrl, sortOrder } = req.body;
  const media = await prisma.eventMedia.create({
    data: { eventId: event.id, type, fileUrl, thumbnailUrl, sortOrder: sortOrder ?? 0 },
  });

  // Keep event.coverImage in sync for convenience when a COVER item is added.
  if (type === "COVER") {
    await prisma.event.update({ where: { id: event.id }, data: { coverImage: fileUrl } });
  }

  return created(res, media);
}

export async function removeMedia(req: Request, res: Response) {
  const media = await prisma.eventMedia.findUnique({ where: { id: req.params.id }, include: { event: true } });
  if (!media) throw ApiError.notFound();
  assertOwnsVendorRecord(req, media.event.vendorId);

  await prisma.eventMedia.delete({ where: { id: media.id } });
  return ok(res, { id: media.id });
}

/**
 * Returns a presigned S3 PUT URL for direct browser upload. Wire this up to your
 * S3-compatible SDK of choice (@aws-sdk/client-s3 + @aws-sdk/s3-request-presigner);
 * left as a clear extension point rather than baking in one provider's SDK config.
 */
export async function getUploadUrl(req: Request, res: Response) {
  const { fileName, contentType } = req.body as { fileName: string; contentType: string };
  if (!fileName || !contentType) throw ApiError.badRequest("fileName and contentType are required");

  // TODO: generate a real presigned URL using env.s3.* config.
  throw ApiError.badRequest("S3 presigned upload not configured — set S3_* env vars and implement in media.service.ts");
}
