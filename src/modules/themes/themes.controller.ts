import { Request, Response } from "express";
import slugify from "slugify";
import { nanoid } from "nanoid";
import { ThemeStatus, UserRole, VendorStatus } from "../../types/enums";
import { Theme, ThemeCategory, VendorTheme, Vendor } from "../../models";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../middleware/auditLog";
import { serialize, serializeMany } from "../../utils/serialize";

async function uniqueThemeSlug(name: string) {
  const base = slugify(name, { lower: true, strict: true });
  let candidate = base;
  let n = 0;
  while (await Theme.findOne({ slug: candidate }).lean()) {
    n += 1;
    candidate = `${base}-${nanoid(4).toLowerCase()}`;
    if (n > 10) candidate = `${base}-${Date.now()}`;
  }
  return candidate;
}

export async function listThemes(req: Request, res: Response) {
  const where: Record<string, unknown> = {};
  if (req.query.categoryId) where.categoryId = req.query.categoryId;

  // Vendors/customers only see published themes; admins can filter or see all.
  const isAdmin =
    req.auth?.role === UserRole.SUPER_ADMIN || req.auth?.role === UserRole.ADMIN;
  if (req.query.status) {
    where.status = req.query.status;
  } else if (!isAdmin) {
    where.status = ThemeStatus.ACTIVE;
  }

  const themes = await Theme.find(where).sort({ createdAt: -1 }).lean();
  const categoryIds = [...new Set(themes.map((t: { categoryId?: string | null }) => t.categoryId).filter(Boolean))] as string[];
  const categories = await ThemeCategory.find({ _id: { $in: categoryIds } }).lean();
  const catById = new Map(categories.map((c: { _id: string }) => [c._id, c]));

  const data = themes.map((t: { categoryId?: string | null } & Record<string, unknown>) => ({
    ...serialize(t),
    category: t.categoryId ? serialize(catById.get(t.categoryId) as Record<string, unknown> | undefined) : null,
  }));
  return ok(res, data);
}

export async function getTheme(req: Request, res: Response) {
  const theme = await Theme.findById(req.params.id).lean();
  if (!theme) throw ApiError.notFound();
  const category = theme.categoryId ? await ThemeCategory.findById(theme.categoryId).lean() : null;
  return ok(res, {
    ...serialize(theme as Record<string, unknown>),
    category: serialize(category as Record<string, unknown> | null),
  });
}

async function assignThemeToActiveVendors(themeId: string) {
  const vendors = await Vendor.find({ status: VendorStatus.ACTIVE }).select("_id").lean();
  if (!vendors.length) return;
  await VendorTheme.bulkWrite(
    vendors.map((v: { _id: string }) => ({
      updateOne: {
        filter: { vendorId: v._id, themeId },
        update: {
          $set: { isEnabled: true },
          // isEnabled is already in $set — repeating it here is a Mongo conflict (code 40).
          $setOnInsert: { vendorId: v._id, themeId, isDefault: false },
        },
        upsert: true,
      },
    }))
  );
}

export async function createTheme(req: Request, res: Response) {
  const { assignToAllVendors: _assignToAllVendors, ...body } = req.body;
  const slug = await uniqueThemeSlug(body.name);
  const theme = await Theme.create({ ...body, slug, createdBy: req.auth?.userId });
  await assignThemeToActiveVendors(String(theme._id));
  await writeAuditLog(req, { action: "CREATE", module: "themes", entityId: theme._id, newData: theme.toJSON() });
  return created(res, theme.toJSON());
}

export async function updateTheme(req: Request, res: Response) {
  const existing = await Theme.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  const oldData = existing.toJSON();
  Object.assign(existing, req.body);
  await existing.save();
  await writeAuditLog(req, { action: "UPDATE", module: "themes", entityId: existing._id, oldData, newData: req.body });
  return ok(res, existing.toJSON());
}

export async function duplicateTheme(req: Request, res: Response) {
  const source = await Theme.findById(req.params.id);
  if (!source) throw ApiError.notFound();

  const name = `${source.name} (Copy)`;
  const slug = await uniqueThemeSlug(name);
  const copy = await Theme.create({
    name,
    slug,
    categoryId: source.categoryId,
    previewImage: source.previewImage,
    config: source.config,
    status: ThemeStatus.DRAFT,
    createdBy: req.auth?.userId,
  });

  await writeAuditLog(req, {
    action: "CREATE",
    module: "themes",
    entityId: copy._id,
    newData: { duplicatedFrom: source._id },
  });
  return created(res, copy.toJSON());
}

export async function assignVendor(req: Request, res: Response) {
  const theme = await Theme.findById(req.params.id);
  if (!theme) throw ApiError.notFound();

  const { vendorId, isEnabled, isDefault } = req.body;

  const update: Record<string, unknown> = {};
  if (isEnabled !== undefined) update.isEnabled = isEnabled;
  if (isDefault !== undefined) update.isDefault = isDefault;

  const assignment = await VendorTheme.findOneAndUpdate(
    { vendorId, themeId: theme._id },
    {
      $set: update,
      // Only default the fields this request isn't setting — a path in both operators is a Mongo conflict.
      $setOnInsert: {
        vendorId,
        themeId: theme._id,
        ...(isEnabled === undefined ? { isEnabled: true } : {}),
        ...(isDefault === undefined ? { isDefault: false } : {}),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await writeAuditLog(req, {
    action: isEnabled === false ? "DISABLE" : "ENABLE",
    module: "vendor_theme_access",
    entityId: assignment._id,
    newData: { vendorId, themeId: theme._id, isEnabled },
  });

  return ok(res, assignment.toJSON());
}

export async function assignAllVendors(req: Request, res: Response) {
  const theme = await Theme.findById(req.params.id);
  if (!theme) throw ApiError.notFound();
  await assignThemeToActiveVendors(String(theme._id));
  await writeAuditLog(req, {
    action: "UPDATE",
    module: "themes",
    entityId: theme._id,
    newData: { assignedToAllVendors: true },
  });
  return ok(res, { assigned: true });
}

/** Themes visible to the caller's vendor tenant (used by vendor-facing theme pickers). */
export async function listVendorThemes(req: Request, res: Response) {
  const vendorId = req.params.vendorId ?? req.auth!.vendorId;
  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const assignments = await VendorTheme.find({ vendorId, isEnabled: true }).lean();
  const themeIds = assignments.map((a: { themeId: string }) => a.themeId);
  const themes = await Theme.find({ _id: { $in: themeIds }, status: ThemeStatus.ACTIVE }).lean();
  const themeById = new Map(themes.map((t: { _id: string }) => [t._id, t]));

  return ok(
    res,
    assignments.map((a: { themeId: string } & Record<string, unknown>) => ({
      ...serialize(a),
      theme: serialize(themeById.get(a.themeId) as Record<string, unknown> | undefined),
    }))
  );
}

// --- Theme categories ---

export async function listThemeCategories(_req: Request, res: Response) {
  const categories = await ThemeCategory.find().sort({ name: 1 }).lean();
  return ok(res, serializeMany(categories as Record<string, unknown>[]));
}

export async function createThemeCategory(req: Request, res: Response) {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const category = await ThemeCategory.create({ name: req.body.name, slug });
  return created(res, category.toJSON());
}
