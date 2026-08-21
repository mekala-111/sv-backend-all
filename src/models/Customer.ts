import { InferSchemaType } from "mongoose";
import { createSchema, getModel } from "./base";
import { CustomerStatus } from "../types/enums";

const customerSchema = createSchema({
  userId: { type: String, required: true, unique: true },
  vendorId: { type: String, required: true, index: true },
  customerCode: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, default: null },
  email: { type: String, default: null },
  status: { type: String, enum: Object.values(CustomerStatus), default: CustomerStatus.ACTIVE },
});

export type CustomerDoc = InferSchemaType<typeof customerSchema> & { _id: string; id: string };
export const Customer = getModel("Customer", customerSchema, "customers");
