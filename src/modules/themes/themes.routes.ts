import { Router } from "express";
import { UserRole } from "../../types/enums";
import * as controller from "./themes.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { createThemeSchema, updateThemeSchema, assignVendorSchema, createThemeCategorySchema } from "./themes.schema";

const router = Router();
router.use(authenticate, attachTenantScope);

const adminOnly = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN);
const anyTenant = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER);

router.get("/categories", anyTenant, controller.listThemeCategories);
router.post("/categories", adminOnly, validateBody(createThemeCategorySchema), controller.createThemeCategory);

router.get("/vendor-assigned", requireRole(UserRole.VENDOR), controller.listVendorThemes);
router.get("/vendor-assigned/:vendorId", adminOnly, controller.listVendorThemes);

router.get("/", adminOnly, controller.listThemes);
router.post("/", adminOnly, validateBody(createThemeSchema), controller.createTheme);
router.get("/:id", anyTenant, controller.getTheme);
router.patch("/:id", adminOnly, validateBody(updateThemeSchema), controller.updateTheme);
router.post("/:id/assign-vendor", adminOnly, validateBody(assignVendorSchema), controller.assignVendor);
router.post("/:id/assign-all-vendors", adminOnly, controller.assignAllVendors);
router.post("/:id/duplicate", adminOnly, controller.duplicateTheme);

export default router;
