import { PrismaClient, UserRole, VendorStatus, UserStatus } from "@prisma/client";
import { hashPassword } from "../src/utils/password";
import { generateCode } from "../src/utils/slug";

const prisma = new PrismaClient();

const PERMISSIONS: { code: string; module: string; description: string }[] = [
  // Vendors
  { code: "vendors.manage", module: "vendors", description: "Create, update, suspend vendors" },
  // Customers
  { code: "customers.manage", module: "customers", description: "Manage customers" },
  { code: "customers.manage_own", module: "customers", description: "Vendor: manage own customers" },
  // Events
  { code: "events.create", module: "events", description: "Create events" },
  { code: "events.manage_own", module: "events", description: "Manage own events" },
  { code: "events.publish", module: "events", description: "Publish/unpublish events" },
  // Themes
  { code: "themes.manage", module: "themes", description: "Create/edit themes" },
  { code: "themes.select", module: "themes", description: "Select from assigned themes" },
  { code: "themes.assign_vendor", module: "themes", description: "Assign themes to vendors" },
  // YouTube
  { code: "youtube.configure", module: "youtube", description: "Connect/manage YouTube channels" },
  // Payments
  { code: "payments.manage", module: "payments", description: "Manage payments" },
  // Settings
  { code: "settings.manage", module: "settings", description: "Manage platform settings" },
];

const ROLE_DEFAULTS: Record<string, string[]> = {
  [UserRole.SUPER_ADMIN]: PERMISSIONS.map((p) => p.code),
  [UserRole.ADMIN]: [
    "vendors.manage",
    "customers.manage",
    "events.create",
    "events.publish",
    "themes.manage",
    "themes.assign_vendor",
    "payments.manage",
  ],
  [UserRole.VENDOR]: [
    "customers.manage_own",
    "events.create",
    "events.manage_own",
    "events.publish",
    "themes.select",
    "youtube.configure",
  ],
  [UserRole.CUSTOMER]: ["events.manage_own", "themes.select"],
};

const THEME_CATEGORIES = ["Wedding", "Engagement", "Birthday", "Traditional", "Devotional", "Corporate", "Concert", "General"];

async function main() {
  console.log("Seeding permissions...");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { code: p.code }, create: p, update: p });
  }

  console.log("Seeding role -> permission defaults...");
  for (const [role, codes] of Object.entries(ROLE_DEFAULTS)) {
    for (const code of codes) {
      const permission = await prisma.permission.findUnique({ where: { code } });
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: { role_permissionId: { role: role as UserRole, permissionId: permission.id } },
        create: { role: role as UserRole, permissionId: permission.id },
        update: {},
      });
    }
  }

  console.log("Seeding theme categories...");
  for (const name of THEME_CATEGORIES) {
    const slug = name.toLowerCase();
    await prisma.themeCategory.upsert({ where: { name }, create: { name, slug }, update: {} });
  }

  console.log("Seeding super admin user...");
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@svlive.in";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "Admin@123";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "SV LIVE Super Admin",
        email,
        passwordHash: await hashPassword(password),
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
    console.log(`Created super admin: ${email} / ${password} (change this password immediately)`);
  } else {
    console.log("Super admin already exists, skipping.");
  }

  console.log("Seeding a demo vendor (optional, for local dev)...");
  const demoEmail = "demo-vendor@svlive.in";
  const demoExisting = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!demoExisting && process.env.SEED_DEMO_DATA === "true") {
    const user = await prisma.user.create({
      data: {
        name: "Demo Vendor",
        email: demoEmail,
        passwordHash: await hashPassword("DemoPass123!"),
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        companyName: "Demo Events Co",
        vendorCode: generateCode("VEN"),
        status: VendorStatus.ACTIVE,
      },
    });
    await prisma.vendorWallet.create({ data: { vendorId: vendor.id } });
    console.log(`Created demo vendor: ${demoEmail} / DemoPass123!`);
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
