import { Router } from "express";
import * as controller from "./auth.controller";
import { validateBody } from "../../middleware/validate";
import {
  loginSchema,
  registerCustomerSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyOtpSchema,
} from "./auth.schema";

const router = Router();

router.post("/register", validateBody(registerCustomerSchema), controller.register);
router.post("/login", validateBody(loginSchema), controller.login);
router.post("/refresh", validateBody(refreshSchema), controller.refresh);
router.post("/logout", validateBody(refreshSchema), controller.logout);
router.post("/forgot-password", validateBody(forgotPasswordSchema), controller.forgotPassword);
router.post("/reset-password", validateBody(resetPasswordSchema), controller.resetPassword);
router.post("/verify-otp", validateBody(verifyOtpSchema), controller.verifyOtp);

export default router;
