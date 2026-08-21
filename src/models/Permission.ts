import { InferSchemaType } from "mongoose";
import { createSchemaNoUpdateAt, getModel } from "./base";
import { UserRole } from "../types/enums";

const permissionSchema = createSchemaNoUpdateAt(
  {
    code: { type: String, required: true, unique: true },
    module: { type: String, required: true },
    description: { type: String, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);

const rolePermissionSchema = createSchemaNoUpdateAt(
  {
    role: { type: String, enum: Object.values(UserRole), required: true },
    permissionId: { type: String, required: true },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);
rolePermissionSchema.index({ role: 1, permissionId: 1 }, { unique: true });

const userPermissionSchema = createSchemaNoUpdateAt(
  {
    userId: { type: String, required: true },
    permissionId: { type: String, required: true },
    allow: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: false, updatedAt: false } }
);
userPermissionSchema.index({ userId: 1, permissionId: 1 }, { unique: true });

export type PermissionDoc = InferSchemaType<typeof permissionSchema> & { _id: string; id: string };
export type RolePermissionDoc = InferSchemaType<typeof rolePermissionSchema> & { _id: string; id: string };
export type UserPermissionDoc = InferSchemaType<typeof userPermissionSchema> & { _id: string; id: string };

export const Permission = getModel("Permission", permissionSchema, "permissions");
export const RolePermission = getModel("RolePermission", rolePermissionSchema, "role_permissions");
export const UserPermission = getModel("UserPermission", userPermissionSchema, "user_permissions");
