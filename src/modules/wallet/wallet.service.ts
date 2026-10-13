import mongoose from "mongoose";
import { WalletTxnType } from "../../types/enums";
import { VendorWallet, WalletTransaction, PlatformWallet, PlatformLedger } from "../../models";
import { ApiError } from "../../utils/apiResponse";
import { runInTransaction } from "../../utils/transaction";

async function getOrCreateWallet(vendorId: string, session?: mongoose.ClientSession) {
  const opts = session ? { session } : {};
  let wallet = await VendorWallet.findOne({ vendorId }, null, opts);
  if (!wallet) {
    const created = await VendorWallet.create([{ vendorId }], opts);
    wallet = created[0];
  }
  return wallet!;
}

async function getOrCreatePlatformWallet(session?: mongoose.ClientSession) {
  const opts = session ? { session } : {};
  let wallet = await PlatformWallet.findOne({ key: "PLATFORM" }, null, opts);
  if (!wallet) {
    const created = await PlatformWallet.create([{ key: "PLATFORM", balance: 0 }], opts);
    wallet = created[0];
  }
  return wallet!;
}

/** Credits a vendor's wallet and writes a matching ledger row inside one transaction. */
export async function creditWallet(
  vendorId: string,
  amount: number,
  referenceType?: string,
  referenceId?: string,
  description?: string
) {
  if (amount <= 0) throw ApiError.badRequest("Credit amount must be positive");

  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(vendorId, session);
    wallet.balance = Number(wallet.balance) + amount;
    await wallet.save({ session });
    await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          type: WalletTxnType.CREDIT,
          amount,
          referenceType,
          referenceId,
          description,
        },
      ],
      { session }
    );
    return wallet;
  });
}

/** Debits a vendor's wallet — throws if the balance would go negative. */
export async function debitWallet(
  vendorId: string,
  amount: number,
  referenceType?: string,
  referenceId?: string,
  description?: string
) {
  if (amount <= 0) throw ApiError.badRequest("Debit amount must be positive");

  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(vendorId, session);
    if (Number(wallet.balance) < amount) throw ApiError.badRequest("Insufficient wallet balance");

    wallet.balance = Number(wallet.balance) - amount;
    await wallet.save({ session });
    await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          type: WalletTxnType.DEBIT,
          amount,
          referenceType,
          referenceId,
          description,
        },
      ],
      { session }
    );
    return wallet;
  });
}

export async function refundWallet(
  vendorId: string,
  amount: number,
  referenceType?: string,
  referenceId?: string,
  description?: string
) {
  return runInTransaction(async (session) => {
    const wallet = await getOrCreateWallet(vendorId, session);
    wallet.balance = Number(wallet.balance) + amount;
    await wallet.save({ session });
    await WalletTransaction.create(
      [
        {
          walletId: wallet._id,
          type: WalletTxnType.REFUND,
          amount,
          referenceType,
          referenceId,
          description,
        },
      ],
      { session }
    );
    return wallet;
  });
}

/** Credits the admin/platform wallet (event creation fees). */
export async function creditPlatform(
  amount: number,
  opts: {
    vendorId?: string;
    referenceType?: string;
    referenceId?: string;
    description?: string;
  } = {}
) {
  if (amount <= 0) throw ApiError.badRequest("Credit amount must be positive");

  return runInTransaction(async (session) => {
    const wallet = await getOrCreatePlatformWallet(session);
    wallet.balance = Number(wallet.balance) + amount;
    await wallet.save({ session });
    await PlatformLedger.create(
      [
        {
          type: WalletTxnType.CREDIT,
          amount,
          vendorId: opts.vendorId ?? null,
          referenceType: opts.referenceType ?? null,
          referenceId: opts.referenceId ?? null,
          description: opts.description ?? null,
        },
      ],
      { session }
    );
    return wallet;
  });
}

export async function getPlatformWallet() {
  return getOrCreatePlatformWallet();
}
