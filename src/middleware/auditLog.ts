import { Request } from "express";
import { prisma } from "../config/prisma";

interface AuditParams {
  action: string; // CREATE | UPDATE | DELETE | ENABLE | DISABLE | PUBLISH | LOGIN | ...
  module: string; // e.g. "vendor_theme_access", "events", "youtube_channels"
  entityType?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
}

/**
 * Writes an audit_logs row. Called explicitly from controllers around
 * sensitive/mutating actions rather than as blanket middleware, so each
 * entry carries a meaningful before/after diff instead of raw request bodies.
 */
export async function writeAuditLog(req: Request, params: AuditParams) {
  await prisma.auditLog.create({
    data: {
      userId: req.auth?.userId ?? null,
      role: req.auth?.role ?? null,
      action: params.action,
      module: params.module,
      entityType: params.entityType,
      entityId: params.entityId,
      oldData: params.oldData as any,
      newData: params.newData as any,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? undefined,
    },
  });
}
