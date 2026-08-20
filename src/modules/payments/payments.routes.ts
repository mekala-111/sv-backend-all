import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "./payments.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { createPaymentSchema } from "./payments.schema";

const router = Router();

// Webhook is unauthenticated (Razorpay calls it directly) but HMAC-verified inside the controller.
router.post("/webhook/razorpay", controller.razorpayWebhook);

router.use(authenticate, attachTenantScope, requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER));
router.get("/", controller.listPayments);
router.post("/", validateBody(createPaymentSchema), controller.createPayment);

export default router;
