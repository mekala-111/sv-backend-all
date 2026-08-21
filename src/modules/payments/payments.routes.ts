import { Router } from "express";
import { UserRole } from "../../types/enums";
import * as controller from "./payments.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import {
  createPaymentSchema,
  submitEventCreationPaymentSchema,
  rejectEventCreationPaymentSchema,
  adminCreditVendorWalletSchema,
} from "./payments.schema";

const router = Router();

router.post("/webhook/razorpay", controller.razorpayWebhook);

router.use(authenticate, attachTenantScope);

router.get(
  "/platform-revenue",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  controller.getPlatformRevenue
);

router.get(
  "/event-creation/config",
  requireRole(UserRole.VENDOR),
  controller.getEventCreationPaymentConfig
);
router.post(
  "/event-creation/submit",
  requireRole(UserRole.VENDOR),
  validateBody(submitEventCreationPaymentSchema),
  controller.submitEventCreationPayment
);
router.post(
  "/:id/approve",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  controller.approveEventCreationPayment
);
router.post(
  "/:id/reject",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateBody(rejectEventCreationPaymentSchema),
  controller.rejectEventCreationPayment
);

router.post(
  "/vendors/:vendorId/credit-wallet",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validateBody(adminCreditVendorWalletSchema),
  controller.adminCreditVendorWallet
);

router.get(
  "/",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER),
  controller.listPayments
);
router.post(
  "/",
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR, UserRole.CUSTOMER),
  validateBody(createPaymentSchema),
  controller.createPayment
);

export default router;
