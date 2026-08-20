import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role: UserRole;
        vendorId?: string | null;
        customerId?: string | null;
      };
    }
  }
}

export {};
