import { Router } from "express";
import { UserRole } from "../../types/enums";
import * as controller from "./media.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { addMediaSchema, uploadUrlSchema } from "./media.schema";

const router = Router();
router.use(authenticate, attachTenantScope, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER));

router.post("/upload-url", validateBody(uploadUrlSchema), controller.getUploadUrl);
router.get("/events/:eventId", controller.listMedia);
router.post("/events/:eventId", validateBody(addMediaSchema), controller.addMedia);
router.delete("/:id", controller.removeMedia);

export default router;
