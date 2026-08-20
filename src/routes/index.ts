import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes";
import adminRoutes from "../modules/admin/admin.routes";
import vendorsRoutes from "../modules/vendors/vendors.routes";
import customersRoutes from "../modules/customers/customers.routes";
import eventsRoutes from "../modules/events/events.routes";
import themesRoutes from "../modules/themes/themes.routes";
import youtubeRoutes from "../modules/youtube/youtube.routes";
import mediaRoutes from "../modules/media/media.routes";
import paymentsRoutes from "../modules/payments/payments.routes";
import walletRoutes from "../modules/wallet/wallet.routes";
import notificationsRoutes from "../modules/notifications/notifications.routes";
import reportsRoutes from "../modules/reports/reports.routes";
import settingsRoutes from "../modules/settings/settings.routes";
import publicRoutes from "../modules/public/public.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/admin", adminRoutes);
router.use("/vendors", vendorsRoutes);
router.use("/customers", customersRoutes);
router.use("/events", eventsRoutes);
router.use("/themes", themesRoutes);
router.use("/youtube", youtubeRoutes);
router.use("/media", mediaRoutes);
router.use("/payments", paymentsRoutes);
router.use("/wallet", walletRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/reports", reportsRoutes);
router.use("/settings", settingsRoutes);
router.use("/public", publicRoutes); // unauthenticated — consumed by the viewer website

export default router;
