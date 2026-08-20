import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "./events.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { createEventSchema, updateEventSchema, setEventAccessSchema, setEventThemeConfigSchema } from "./events.schema";

const router = Router();
router.use(authenticate, attachTenantScope);

const canManage = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER);

router.get("/", canManage, controller.listEvents);
router.post("/", canManage, validateBody(createEventSchema), controller.createEvent);
router.get("/:id", canManage, controller.getEvent);
router.patch("/:id", canManage, validateBody(updateEventSchema), controller.updateEvent);
router.delete("/:id", canManage, controller.deleteEvent);

router.post("/:id/publish", canManage, controller.publishEvent);
router.post("/:id/unpublish", canManage, controller.unpublishEvent);
router.post("/:id/preview", canManage, controller.previewEvent);

router.put("/:id/theme-config", canManage, validateBody(setEventThemeConfigSchema), controller.setEventThemeConfig);
router.put("/:id/access", canManage, validateBody(setEventAccessSchema), controller.setEventAccess);

export default router;
