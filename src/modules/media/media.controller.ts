import { Request, Response } from "express";
import { Event, EventMedia } from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { assertOwnsVendorRecord } from "../../middleware/tenantScope";
import { serialize, serializeMany } from "../../utils/serialize";

export async function listMedia(req: Request, res: Response) {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const media = await EventMedia.find({ eventId: event._id }).sort({ sortOrder: 1 }).lean();
  return ok(res, serializeMany(media as Record<string, unknown>[]));
}

/** Registers an already-uploaded file (uploaded via a presigned S3 URL) against an event. */
export async function addMedia(req: Request, res: Response) {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  const { type, fileUrl, thumbnailUrl, sortOrder } = req.body;
  const media = await EventMedia.create({
    eventId: event._id,
    type,
    fileUrl,
    thumbnailUrl,
    sortOrder: sortOrder ?? 0,
  });

  // Keep event.coverImage in sync for convenience when a COVER item is added.
  if (type === "COVER") {
    event.coverImage = fileUrl;
    await event.save();
  }

  return created(res, media.toJSON());
}

export async function removeMedia(req: Request, res: Response) {
  const media = await EventMedia.findById(req.params.id);
  if (!media) throw ApiError.notFound();
  const event = await Event.findById(media.eventId);
  if (!event) throw ApiError.notFound();
  assertOwnsVendorRecord(req, event.vendorId);

  await EventMedia.deleteOne({ _id: media._id });
  return ok(res, { id: media._id });
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
