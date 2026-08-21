import { Router } from "express";
import { UserRole } from "../../types/enums";
import * as controller from "./customers.controller";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { attachTenantScope } from "../../middleware/tenantScope";
import { validateBody } from "../../middleware/validate";
import { createCustomerSchema, updateCustomerSchema } from "./customers.schema";

const router = Router();
router.use(authenticate, attachTenantScope);

const canManage = requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VENDOR);

router.get("/", canManage, controller.listCustomers);
router.post("/", canManage, validateBody(createCustomerSchema), controller.createCustomer);
router.get("/:id", canManage, controller.getCustomer);
router.patch("/:id", canManage, validateBody(updateCustomerSchema), controller.updateCustomer);

export default router;
