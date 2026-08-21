import { InferSchemaType } from "mongoose";
import { createSchema, createSchemaNoUpdateAt, getModel } from "./base";
import { PaymentStatus, WalletTxnType } from "../types/enums";

const paymentSchema = createSchemaNoUpdateAt({
  vendorId: { type: String, default: null, index: true },
  customerId: { type: String, default: null },
  eventId: { type: String, default: null, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  gateway: { type: String, required: true },
  /** UTR / transaction reference for QR payments */
  gatewayTransactionId: { type: String, default: null, index: true },
  status: { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.PENDING },
  /** CUSTOMER = viewer/customer payment to vendor; EVENT_CREATION = vendor fee to admin */
  purpose: { type: String, default: "CUSTOMER", index: true },
  utrNumber: { type: String, default: null, index: true },
  paymentImage: { type: String, default: null },
  rejectionReason: { type: String, default: null },
  reviewedAt: { type: Date, default: null },
  reviewedBy: { type: String, default: null },
  paidAt: { type: Date, default: null },
});

const vendorWalletSchema = createSchema(
  {
    vendorId: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const walletTransactionSchema = createSchemaNoUpdateAt({
  walletId: { type: String, required: true, index: true },
  type: { type: String, enum: Object.values(WalletTxnType), required: true },
  amount: { type: Number, required: true },
  referenceType: { type: String, default: null },
  referenceId: { type: String, default: null },
  description: { type: String, default: null },
});

/** Singleton platform (admin) wallet that receives event-creation fees. */
const platformWalletSchema = createSchema(
  {
    key: { type: String, required: true, unique: true, default: "PLATFORM" },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

const platformLedgerSchema = createSchemaNoUpdateAt({
  type: { type: String, enum: Object.values(WalletTxnType), required: true },
  amount: { type: Number, required: true },
  referenceType: { type: String, default: null },
  referenceId: { type: String, default: null },
  description: { type: String, default: null },
  vendorId: { type: String, default: null, index: true },
});

export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: string; id: string };
export type VendorWalletDoc = InferSchemaType<typeof vendorWalletSchema> & { _id: string; id: string };
export type WalletTransactionDoc = InferSchemaType<typeof walletTransactionSchema> & { _id: string; id: string };
export type PlatformWalletDoc = InferSchemaType<typeof platformWalletSchema> & { _id: string; id: string };
export type PlatformLedgerDoc = InferSchemaType<typeof platformLedgerSchema> & { _id: string; id: string };

export const Payment = getModel("Payment", paymentSchema, "payments");
export const VendorWallet = getModel("VendorWallet", vendorWalletSchema, "vendor_wallets");
export const WalletTransaction = getModel("WalletTransaction", walletTransactionSchema, "wallet_transactions");
export const PlatformWallet = getModel("PlatformWallet", platformWalletSchema, "platform_wallets");
export const PlatformLedger = getModel("PlatformLedger", platformLedgerSchema, "platform_ledger");
