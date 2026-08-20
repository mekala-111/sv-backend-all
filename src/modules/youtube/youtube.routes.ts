import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "./youtube.controller";
import { authenticate, optionalAuthenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { createStreamSchema } from "./youtube.schema";

const router = Router();

// Google redirects here without our auth header, so this route uses `state` (vendorId) instead.
router.get("/callback", optionalAuthenticate, controller.callback);

router.use(authenticate, attachTenantScope, requireRole(UserRole.VENDOR, UserRole.SUPER_ADMIN, UserRole.ADMIN));

router.get("/channels", controller.listChannels);
router.post("/connect", controller.connect);
router.post("/disconnect/:id", controller.disconnect);

router.get("/streams", controller.listStreams);
router.get("/streams/:id", controller.getStream);
router.post("/streams", validateBody(createStreamSchema), controller.createStream);
router.post("/sync", controller.syncStreams);

export default router;
