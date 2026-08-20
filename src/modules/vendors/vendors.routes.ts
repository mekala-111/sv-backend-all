import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "./vendors.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { createVendorSchema, updateVendorSchema } from "./vendors.schema";

const router = Router();
router.use(authenticate, attachTenantScope);

// Vendor self-service
router.get("/me", requireRole(UserRole.VENDOR), controller.getMyVendorProfile);

// Admin-managed vendor CRUD
const adminOnly = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN);
router.get("/", adminOnly, controller.listVendors);
router.post("/", adminOnly, validateBody(createVendorSchema), controller.createVendor);
router.get("/:id", adminOnly, controller.getVendor);
router.patch("/:id", adminOnly, validateBody(updateVendorSchema), controller.updateVendor);
router.delete("/:id", adminOnly, controller.deleteVendor);

export default router;
