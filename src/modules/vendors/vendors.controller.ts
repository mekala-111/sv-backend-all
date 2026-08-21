import mongoose from "mongoose";
import { Request, Response } from "express";
import { UserRole, UserStatus, VendorStatus, EventStatus, PaymentStatus } from "../../types/enums";
import { User, Vendor, VendorWallet, Event, Customer, Payment } from "../../models";
import { hashPassword } from "../../utils/password";
import { generateCode } from "../../utils/slug";
import { ApiError, created, ok } from "../../utils/apiResponse";
import { writeAuditLog } from "../../middleware/auditLog";
import { serialize, serializeMany } from "../../utils/serialize";

export async function createVendor(req: Request, res: Response) {
  const {
    name,
    email,
    password,
    phone,
    companyName,
    logo,
    address,
    planId,
    whatsappNumber,
    eventCreationFee,
    initialWalletCredit,
  } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw ApiError.conflict("Email already in use");

  const passwordHash = await hashPassword(password);

  const session = await mongoose.startSession();
  session.startTransaction();
  let vendor;
  try {
    const [user] = await User.create(
      [{ name, email, phone, passwordHash, role: UserRole.VENDOR, status: UserStatus.ACTIVE }],
      { session }
    );
    const [createdVendor] = await Vendor.create(
      [
        {
          userId: user._id,
          companyName,
          vendorCode: generateCode("VEN"),
          logo,
          phone,
          email,
          address,
          planId,
          whatsappNumber,
          eventCreationFee: Number(eventCreationFee ?? 0),
          status: VendorStatus.ACTIVE,
        },
      ],
      { session }
    );
    await VendorWallet.create(
      [{ vendorId: createdVendor._id, balance: Number(initialWalletCredit ?? 0) }],
      { session }
    );
    vendor = createdVendor;
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  await writeAuditLog(req, { action: "CREATE", module: "vendors", entityId: vendor._id, newData: vendor.toJSON() });
  return created(res, vendor.toJSON());
}

export async function listVendors(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const search = typeof req.query.search === "string" ? req.query.search : undefined;

  const where = search
    ? {
        $or: [
          { companyName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { vendorCode: { $regex: search, $options: "i" } },
        ],
      }
    : {};

  const [items, total] = await Promise.all([
    Vendor.find(where).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Vendor.countDocuments(where),
  ]);

  return ok(res, serializeMany(items as Record<string, unknown>[]), {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function getVendor(req: Request, res: Response) {
  const vendor = await Vendor.findById(req.params.id).lean();
  if (!vendor) throw ApiError.notFound();
  return ok(res, serialize(vendor as Record<string, unknown>));
}

/** Vendor's own profile — resolved from req.auth rather than a path param, so a vendor can never view another's profile by ID. */
export async function getMyVendorProfile(req: Request, res: Response) {
  const vendor = await Vendor.findById(req.auth!.vendorId!).lean();
  if (!vendor) throw ApiError.notFound();
  const wallet = await VendorWallet.findOne({ vendorId: vendor._id }).lean();
  return ok(res, { ...serialize(vendor as Record<string, unknown>), wallet: serialize(wallet as Record<string, unknown> | null) });
}

export async function updateVendor(req: Request, res: Response) {
  const existing = await Vendor.findById(req.params.id);
  if (!existing) throw ApiError.notFound();

  Object.assign(existing, req.body);
  await existing.save();
  await writeAuditLog(req, {
    action: "UPDATE",
    module: "vendors",
    entityId: existing._id,
    oldData: existing.toJSON(),
    newData: req.body,
  });
  return ok(res, existing.toJSON());
}

export async function deleteVendor(req: Request, res: Response) {
  const existing = await Vendor.findById(req.params.id);
  if (!existing) throw ApiError.notFound();
  // Soft-delete via status rather than a hard delete, to preserve historical events/payments.
  const oldData = existing.toJSON();
  existing.status = VendorStatus.INACTIVE;
  await existing.save();
  await writeAuditLog(req, { action: "DELETE", module: "vendors", entityId: existing._id, oldData });
  return ok(res, existing.toJSON());
}

export async function updateMyVendorProfile(req: Request, res: Response) {
  const vendor = await Vendor.findById(req.auth!.vendorId!);
  if (!vendor) throw ApiError.notFound();

  const allowed = ["companyName", "logo", "phone", "email", "address", "whatsappNumber", "whatsappEnabled"] as const;
  for (const key of allowed) {
    if (req.body[key] !== undefined) (vendor as any)[key] = req.body[key];
  }
  await vendor.save();
  await writeAuditLog(req, { action: "UPDATE", module: "vendors", entityId: vendor._id, newData: req.body });
  return ok(res, vendor.toJSON());
}

export async function getMyDashboard(req: Request, res: Response) {
  const vendorId = req.auth!.vendorId!;
  const [eventsTotal, eventsLive, eventsUpcoming, customersTotal, revenueAgg] = await Promise.all([
    Event.countDocuments({ vendorId }),
    Event.countDocuments({ vendorId, status: EventStatus.LIVE }),
    Event.countDocuments({ vendorId, status: EventStatus.UPCOMING }),
    Customer.countDocuments({ vendorId }),
    Payment.aggregate([
      { $match: { vendorId, status: PaymentStatus.SUCCESS } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);

  const wallet = await VendorWallet.findOne({ vendorId }).lean();

  return ok(res, {
    eventsTotal,
    eventsLive,
    eventsUpcoming,
    customersTotal,
    revenue: revenueAgg[0]?.total ?? 0,
    successfulPayments: revenueAgg[0]?.count ?? 0,
    walletBalance: wallet?.balance ?? 0,
  });
}

export async function getMyBranding(req: Request, res: Response) {
  const vendor = await Vendor.findById(req.auth!.vendorId!).lean();
  if (!vendor) throw ApiError.notFound();
  return ok(res, vendor.branding ?? {});
}

export async function updateMyBranding(req: Request, res: Response) {
  const vendor = await Vendor.findById(req.auth!.vendorId!);
  if (!vendor) throw ApiError.notFound();

  vendor.branding = { ...(vendor.branding as object), ...req.body };
  await vendor.save();
  await writeAuditLog(req, { action: "UPDATE", module: "vendor_branding", entityId: vendor._id, newData: req.body });
  return ok(res, vendor.branding);
}
