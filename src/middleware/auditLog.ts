import { Request } from "express";
import { AuditLog } from "../models";

interface AuditParams {
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  oldData?: unknown;
  newData?: unknown;
}

export async function writeAuditLog(req: Request, params: AuditParams) {
  await AuditLog.create({
    userId: req.auth?.userId ?? null,
    role: req.auth?.role ?? null,
    action: params.action,
    module: params.module,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    oldData: params.oldData ?? null,
    newData: params.newData ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.headers["user-agent"] ?? null,
  });
}
