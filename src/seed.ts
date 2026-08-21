import { connectMongo, disconnectMongo } from "./config/mongo";
import {
  Permission,
  RolePermission,
  Theme,
  ThemeCategory,
  User,
  Vendor,
  VendorWallet,
  Plan,
} from "./models";
import { UserRole, UserStatus, VendorStatus, PlanStatus, ThemeStatus } from "./types/enums";
import { hashPassword } from "./utils/password";
import { generateCode } from "./utils/slug";

const PERMISSIONS: { code: string; module: string; description: string }[] = [
  { code: "vendors.manage", module: "vendors", description: "Create, update, suspend vendors" },
  { code: "customers.manage", module: "customers", description: "Manage customers" },
  { code: "customers.manage_own", module: "customers", description: "Vendor: manage own customers" },
  { code: "events.create", module: "events", description: "Create events" },
  { code: "events.manage_own", module: "events", description: "Manage own events" },
  { code: "events.publish", module: "events", description: "Publish/unpublish events" },
  { code: "themes.manage", module: "themes", description: "Create/edit themes" },
  { code: "themes.select", module: "themes", description: "Select themes for events" },
  { code: "themes.assign_vendor", module: "themes", description: "Assign themes to vendors" },
  { code: "youtube.configure", module: "youtube", description: "Connect/manage YouTube channels" },
  { code: "payments.manage", module: "payments", description: "Manage payments" },
  { code: "settings.manage", module: "settings", description: "Manage platform settings" },
  { code: "support.manage", module: "support", description: "Manage support tickets" },
  { code: "plans.manage", module: "plans", description: "Manage pricing plans" },
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
    "support.manage",
    "plans.manage",
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

const THEME_CATEGORIES = [
  "Wedding",
  "Engagement",
  "Birthday",
  "Traditional",
  "Devotional",
  "Corporate",
  "Concert",
  "General",
];

async function main() {
  await connectMongo();

  console.log("Seeding permissions...");
  for (const p of PERMISSIONS) {
    await Permission.findOneAndUpdate({ code: p.code }, p, { upsert: true, new: true, setDefaultsOnInsert: true });
  }

  console.log("Seeding role -> permission defaults...");
  for (const [role, codes] of Object.entries(ROLE_DEFAULTS)) {
    for (const code of codes) {
      const permission = await Permission.findOne({ code });
      if (!permission) continue;
      await RolePermission.findOneAndUpdate(
        { role, permissionId: permission._id },
        { role, permissionId: permission._id },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log("Seeding theme categories...");
  const categoryByName = new Map<string, string>();
  for (const name of THEME_CATEGORIES) {
    const slug = name.toLowerCase();
    const cat = await ThemeCategory.findOneAndUpdate(
      { name },
      { name, slug },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    categoryByName.set(name, cat._id);
  }

  console.log("Seeding default themes...");
  const defaultThemes = [
    {
      name: "Wedding Theme Traditional",
      slug: "wedding-theme-traditional",
      category: "Wedding",
      config: {
        layout: "wedding-theme-traditional",
        colors: {
          primary: "#B8860A",
          secondary: "#7A1626",
          accent: "#D8B25C",
          background: "#FBF6EC",
          text: "#5A4A2E",
        },
        fontFamily: "Great Vibes, Cormorant Garamond, serif",
        assetPath: "/themes/wedding-theme-traditional",
      },
    },
    {
      name: "Cinematic",
      slug: "cinematic",
      category: "Wedding",
      config: {
        layout: "cinematic",
        colors: { primary: "#E8C36A", secondary: "#1A1208", accent: "#E8C36A", background: "#0B0908", text: "#F7F1E6" },
        fontFamily: "Cormorant Garamond, Georgia, serif",
      },
    },
    {
      name: "Traditional",
      slug: "traditional",
      category: "Traditional",
      config: {
        layout: "traditional",
        colors: { primary: "#8B1E3F", secondary: "#F5E6D3", accent: "#C9A227", background: "#2A0F18", text: "#F8EFE4" },
        fontFamily: "Playfair Display, Georgia, serif",
      },
    },
    {
      name: "Floral Rose",
      slug: "floral-rose",
      category: "Wedding",
      config: {
        layout: "floral",
        colors: { primary: "#C45C7A", secondary: "#FFE8F0", accent: "#E8A0B5", background: "#FFF7FA", text: "#4A2A35" },
        fontFamily: "Great Vibes, cursive",
      },
    },
    {
      name: "Classic Light",
      slug: "classic-light",
      category: "General",
      config: {
        layout: "classic",
        colors: { primary: "#1F4B7A", secondary: "#EEF3F8", accent: "#C9A227", background: "#F7F9FC", text: "#1B2430" },
        fontFamily: "Lora, Georgia, serif",
      },
    },
  ];
  for (const t of defaultThemes) {
    await Theme.findOneAndUpdate(
      { slug: t.slug },
      {
        name: t.name,
        slug: t.slug,
        categoryId: categoryByName.get(t.category) ?? null,
        config: t.config,
        status: ThemeStatus.ACTIVE,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("Seeding plans...");
  const plans = [
    {
      name: "Starter",
      code: "starter",
      price: 2999,
      eventLimit: 10,
      hoursLimit: 50,
      storageGb: 100,
      viewerLimit: 500,
      features: { recording: "Basic", branding: false, support: "Email" },
    },
    {
      name: "Professional",
      code: "professional",
      price: 8999,
      eventLimit: 50,
      hoursLimit: 300,
      storageGb: 1000,
      viewerLimit: 5000,
      features: { recording: "Full", branding: true, support: "Priority" },
    },
    {
      name: "Enterprise",
      code: "enterprise",
      price: 0,
      eventLimit: -1,
      hoursLimit: -1,
      storageGb: 10000,
      viewerLimit: -1,
      features: { recording: "Full + Multi-camera", branding: true, support: "Dedicated" },
    },
  ];
  for (const plan of plans) {
    await Plan.findOneAndUpdate(
      { code: plan.code },
      { ...plan, status: PlanStatus.ACTIVE, currency: "INR", billingPeriod: "monthly" },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("Seeding super admin user...");
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@svlive.in";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "Admin@123";
  const passwordHash = await hashPassword(password);
  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: "SV LIVE Super Admin",
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
    });
    console.log(`Created super admin: ${email} / ${password}`);
  } else {
    existing.passwordHash = passwordHash;
    existing.status = UserStatus.ACTIVE;
    existing.emailVerified = true;
    await existing.save();
    console.log(`Updated super admin password: ${email} / ${password}`);
  }

  if (process.env.SEED_DEMO_DATA === "true") {
    console.log("Seeding demo vendor...");
    const demoEmail = "demo-vendor@svlive.in";
    const demoExisting = await User.findOne({ email: demoEmail });
    if (!demoExisting) {
      const user = await User.create({
        name: "Demo Vendor",
        email: demoEmail,
        passwordHash: await hashPassword("DemoPass123!"),
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        emailVerified: true,
      });
      const vendor = await Vendor.create({
        userId: user._id,
        companyName: "Demo Events Co",
        vendorCode: generateCode("VEN"),
        status: VendorStatus.ACTIVE,
        email: demoEmail,
      });
      await VendorWallet.create({ vendorId: vendor._id, balance: 0, currency: "INR" });
      console.log(`Created demo vendor: ${demoEmail} / DemoPass123!`);
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMongo();
  });
