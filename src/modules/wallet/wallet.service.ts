import { WalletTxnType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/apiResponse";

async function getOrCreateWallet(vendorId: string) {
  return prisma.vendorWallet.upsert({
    where: { vendorId },
    create: { vendorId },
    update: {},
  });
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

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.vendorWallet.upsert({ where: { vendorId }, create: { vendorId }, update: {} });
    const updated = await tx.vendorWallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: WalletTxnType.CREDIT, amount, referenceType, referenceId, description },
    });
    return updated;
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

  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(vendorId);
    if (Number(wallet.balance) < amount) throw ApiError.badRequest("Insufficient wallet balance");

    const updated = await tx.vendorWallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: WalletTxnType.DEBIT, amount, referenceType, referenceId, description },
    });
    return updated;
  });
}

export async function refundWallet(vendorId: string, amount: number, referenceType?: string, referenceId?: string, description?: string) {
  return prisma.$transaction(async (tx) => {
    const wallet = await getOrCreateWallet(vendorId);
    const updated = await tx.vendorWallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: WalletTxnType.REFUND, amount, referenceType, referenceId, description },
    });
    return updated;
  });
}
