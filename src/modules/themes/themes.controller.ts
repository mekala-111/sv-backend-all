import { Request, Response } from "express";
import slugify from "slugify";
import { nanoid } from "nanoid";
import { prisma } from "../../config/prisma";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../middleware/auditLog";

async function uniqueThemeSlug(name: string) {
  const base = slugify(name, { lower: true, strict: true });
  let candidate = base;
  let n = 0;
  while (await prisma.theme.findUnique({ where: { slug: candidate } })) {
    n += 1;
    candidate = `${base}-${nanoid(4).toLowerCase()}`;
    if (n > 10) candidate = `${base}-${Date.now()}`;
  }
  return candidate;
}

export async function listThemes(req: Request, res: Response) {
  const where: Record<string, unknown> = {};
  if (req.query.categoryId) where.categoryId = req.query.categoryId;
  if (req.query.status) where.status = req.query.status;

  const themes = await prisma.theme.findMany({ where, include: { category: true }, orderBy: { createdAt: "desc" } });
  return ok(res, themes);
}

export async function getTheme(req: Request, res: Response) {
  const theme = await prisma.theme.findUnique({ where: { id: req.params.id }, include: { category: true } });
  if (!theme) throw ApiError.notFound();
  return ok(res, theme);
}

export async function createTheme(req: Request, res: Response) {
  const slug = await uniqueThemeSlug(req.body.name);
  const theme = await prisma.theme.create({ data: { ...req.body, slug, createdBy: req.auth?.userId } });
  await writeAuditLog(req, { action: "CREATE", module: "themes", entityId: theme.id, newData: theme });
  return created(res, theme);
}

export async function updateTheme(req: Request, res: Response) {
  const existing = await prisma.theme.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound();
  const theme = await prisma.theme.update({ where: { id: req.params.id }, data: req.body });
  await writeAuditLog(req, { action: "UPDATE", module: "themes", entityId: theme.id, oldData: existing, newData: req.body });
  return ok(res, theme);
}

export async function duplicateTheme(req: Request, res: Response) {
  const source = await prisma.theme.findUnique({ where: { id: req.params.id } });
  if (!source) throw ApiError.notFound();

  const name = `${source.name} (Copy)`;
  const slug = await uniqueThemeSlug(name);
  const copy = await prisma.theme.create({
    data: {
      name,
      slug,
      categoryId: source.categoryId,
      previewImage: source.previewImage,
      config: source.config as any,
      status: "DRAFT",
      createdBy: req.auth?.userId,
    },
  });

  await writeAuditLog(req, { action: "CREATE", module: "themes", entityId: copy.id, newData: { duplicatedFrom: source.id } });
  return created(res, copy);
}

export async function assignVendor(req: Request, res: Response) {
  const theme = await prisma.theme.findUnique({ where: { id: req.params.id } });
  if (!theme) throw ApiError.notFound();

  const { vendorId, isEnabled, isDefault } = req.body;

  const assignment = await prisma.vendorTheme.upsert({
    where: { vendorId_themeId: { vendorId, themeId: theme.id } },
    create: { vendorId, themeId: theme.id, isEnabled: isEnabled ?? true, isDefault: isDefault ?? false },
    update: { ...(isEnabled !== undefined ? { isEnabled } : {}), ...(isDefault !== undefined ? { isDefault } : {}) },
  });

  await writeAuditLog(req, {
    action: isEnabled === false ? "DISABLE" : "ENABLE",
    module: "vendor_theme_access",
    entityId: assignment.id,
    newData: { vendorId, themeId: theme.id, isEnabled },
  });

  return ok(res, assignment);
}

/** Themes visible to the caller's vendor tenant (used by vendor-facing theme pickers). */
export async function listVendorThemes(req: Request, res: Response) {
  const vendorId = req.params.vendorId ?? req.auth!.vendorId;
  if (!vendorId) throw ApiError.badRequest("vendorId is required");

  const assignments = await prisma.vendorTheme.findMany({
    where: { vendorId, isEnabled: true },
    include: { theme: true },
  });
  return ok(res, assignments);
}

// --- Theme categories ---

export async function listThemeCategories(_req: Request, res: Response) {
  const categories = await prisma.themeCategory.findMany({ orderBy: { name: "asc" } });
  return ok(res, categories);
}

export async function createThemeCategory(req: Request, res: Response) {
  const slug = slugify(req.body.name, { lower: true, strict: true });
  const category = await prisma.themeCategory.create({ data: { name: req.body.name, slug } });
  return created(res, category);
}
