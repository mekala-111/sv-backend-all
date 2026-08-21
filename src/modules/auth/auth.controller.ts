import { Request, Response } from "express";
import { ok, created } from "../../utils/apiResponse";
import * as authService from "./auth.service";

export async function register(req: Request, res: Response) {
  const tokens = await authService.registerCustomer(req.body);
  return created(res, tokens);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const { user, accessToken, refreshToken } = await authService.login(email, password);
  return ok(res, {
    user: { id: String(user._id), name: user.name, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  });
}

export async function refresh(req: Request, res: Response) {
  const tokens = await authService.refreshAccessToken(req.body.refreshToken);
  return ok(res, tokens);
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.body.refreshToken);
  return ok(res, { loggedOut: true });
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.requestPasswordReset(req.body.email);
  // Always return success shape regardless of whether the email exists.
  return ok(res, { message: "If that email exists, a reset code has been sent." });
}

export async function resetPassword(req: Request, res: Response) {
  await authService.resetPassword(req.body.email, req.body.code, req.body.newPassword);
  return ok(res, { message: "Password updated. Please log in again." });
}

export async function verifyOtp(req: Request, res: Response) {
  const result = await authService.verifyOtp(req.body.email, req.body.code, req.body.purpose);
  return ok(res, result);
}
