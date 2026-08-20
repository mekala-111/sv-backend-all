import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiResponse";
import { ok, created } from "../utils/apiResponse";
import { vendorScopeWhere } from "../middleware/tenantScope";
import { writeAuditLog } from "../middleware/auditLog";

type PrismaDelegate = {
  findMany: (args: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any>;
  count: (args: any) => Promise<number>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
};

interface CrudFactoryOptions {
  /** Prisma model name as exposed on the client, e.g. "vendor", "customer", "notification". */
  model: keyof typeof prisma;
  moduleName: string; // for audit logs
  /** Apply tenant scoping (vendorId/customerId) automatically. Set false for admin-only resources. */
  scoped?: boolean;
  /** Fields allowed on create/update, to avoid mass-assignment of protected columns. */
  allowedFields: string[];
  /** Inject extra fields (e.g. vendorId) into create payload based on the requester. */
  onCreate?: (req: Request) => Record<string, unknown>;
  searchableFields?: string[];
}

function pick(body: Record<string, unknown>, allowed: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

export function crudFactory(opts: CrudFactoryOptions) {
  const delegate = () => prisma[opts.model] as unknown as PrismaDelegate;

  return {
    list: async (req: Request, res: Response) => {
      const where = opts.scoped !== false ? vendorScopeWhere(req) : {};
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const search = typeof req.query.search === "string" ? req.query.search : undefined;

      const searchWhere =
        search && opts.searchableFields?.length
          ? { OR: opts.searchableFields.map((field) => ({ [field]: { contains: search } })) }
          : {};

      const finalWhere = { ...where, ...searchWhere };

      const [items, total] = await Promise.all([
        delegate().findMany({ where: finalWhere, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
        delegate().count({ where: finalWhere }),
      ]);

      return ok(res, items, { page, limit, total, totalPages: Math.ceil(total / limit) });
    },

    get: async (req: Request, res: Response) => {
      const where = opts.scoped !== false ? vendorScopeWhere(req) : {};
      const record = await delegate().findUnique({ where: { id: req.params.id } });
      if (!record) throw ApiError.notFound();
      if (opts.scoped !== false) {
        for (const [key, value] of Object.entries(where)) {
          if (value !== undefined && record[key] !== value) throw ApiError.forbidden();
        }
      }
      return ok(res, record);
    },

    create: async (req: Request, res: Response) => {
      const data = { ...pick(req.body, opts.allowedFields), ...(opts.onCreate?.(req) ?? {}) };
      const record = await delegate().create({ data });
      await writeAuditLog(req, { action: "CREATE", module: opts.moduleName, entityId: record.id, newData: data });
      return created(res, record);
    },

    update: async (req: Request, res: Response) => {
      const existing = await delegate().findUnique({ where: { id: req.params.id } });
      if (!existing) throw ApiError.notFound();
      const data = pick(req.body, opts.allowedFields);
      const record = await delegate().update({ where: { id: req.params.id }, data });
      await writeAuditLog(req, {
        action: "UPDATE",
        module: opts.moduleName,
        entityId: record.id,
        oldData: existing,
        newData: data,
      });
      return ok(res, record);
    },

    remove: async (req: Request, res: Response) => {
      const existing = await delegate().findUnique({ where: { id: req.params.id } });
      if (!existing) throw ApiError.notFound();
      await delegate().delete({ where: { id: req.params.id } });
      await writeAuditLog(req, { action: "DELETE", module: opts.moduleName, entityId: req.params.id, oldData: existing });
      return ok(res, { id: req.params.id });
    },
  };
}
