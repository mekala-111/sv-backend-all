/**
 * Seeds the CSS-only "Event Banner" starter themes and enables them for every vendor.
 * Safe to re-run: existing themes (matched by slug) are left exactly as admins edited them.
 *
 *   npx ts-node --transpile-only scripts/seed-banner-themes.ts
 *
 * The artwork itself lives in the frontends (themes/lib/banner-presets.ts); this only stores
 * which preset a theme uses, plus its colours, font and event types.
 */
import { connectMongo, disconnectMongo } from "../src/config/mongo";
import { Theme, Vendor, VendorTheme } from "../src/models";
import { ThemeStatus } from "../src/types/enums";

const LIVE_SECTIONS = {
  showCountdown: true,
  showGallery: true,
  showSubEvents: false,
  showLivePlayer: true,
  showInvitationCard: false,
  showCouplePhotos: false,
};

type Starter = {
  banner: string;
  name: string;
  eventTypes: string[];
  colors: { primary: string; secondary: string; accent: string; background: string; text: string };
  fontFamily: string;
};

const STARTERS: Starter[] = [
  {
    banner: "birthday",
    name: "Birthday Balloons",
    eventTypes: ["Birthday"],
    colors: { primary: "#E9B949", secondary: "#123A9C", accent: "#7FB6FF", background: "#EEF3FF", text: "#14213D" },
    fontFamily: "Dancing Script, Lora, serif",
  },
  {
    banner: "wedding-floral",
    name: "Wedding Floral",
    eventTypes: ["Marriage", "Marriage-Events", "Engagement", "Reception"],
    colors: { primary: "#B08D3C", secondary: "#2F5D46", accent: "#C9737F", background: "#FBF8F1", text: "#3B3326" },
    fontFamily: "Great Vibes, Cormorant Garamond, serif",
  },
  {
    banner: "public-event",
    name: "Public Event Spotlight",
    eventTypes: ["General Event", "Reunion", "Retirement"],
    colors: { primary: "#4FC3F7", secondary: "#0B1B3F", accent: "#B3E5FC", background: "#F2F6FC", text: "#0B1B3F" },
    fontFamily: "Lora, Georgia, serif",
  },
  {
    banner: "devotional",
    name: "Devotional Saffron",
    eventTypes: ["Devotional", "Padi Pooja"],
    colors: { primary: "#F4A300", secondary: "#6E0F1F", accent: "#FFD27A", background: "#FFF7EA", text: "#4A1A10" },
    fontFamily: "Cormorant Garamond, Georgia, serif",
  },
  {
    banner: "housewarming",
    name: "Gruhapravesham",
    eventTypes: ["Gruhapravesham"],
    colors: { primary: "#E07B24", secondary: "#7A2E12", accent: "#F2C14E", background: "#FFF6EC", text: "#4A2410" },
    fontFamily: "Cormorant Garamond, Georgia, serif",
  },
  {
    banner: "baby",
    name: "Baby Pastel",
    eventTypes: ["Baby Shower", "Cradle Ceremony", "Namakarana", "Seemantham"],
    colors: { primary: "#E88FB0", secondary: "#7FB8E6", accent: "#FFD6E4", background: "#FFF8FB", text: "#4A3A55" },
    fontFamily: "Dancing Script, Lora, serif",
  },
  {
    banner: "sangeeth",
    name: "Sangeeth Night",
    eventTypes: ["Sangeeth", "Half Saree", "Vonifunction"],
    colors: { primary: "#FF4FA3", secondary: "#2A0D4A", accent: "#FFC857", background: "#FBF3FF", text: "#2A0D4A" },
    fontFamily: "Great Vibes, Lora, serif",
  },
  {
    banner: "traditional-maroon",
    name: "Traditional Maroon & Gold",
    eventTypes: ["Upanayanam", "Dhothi Ceremony", "Shastipoorthi"],
    colors: { primary: "#D4A53C", secondary: "#6B0F1A", accent: "#F3D58A", background: "#FBF4E8", text: "#4A0E14" },
    fontFamily: "Cormorant Garamond, Georgia, serif",
  },
  {
    banner: "church",
    name: "Church Light",
    eventTypes: ["Church Event"],
    colors: { primary: "#3A6EA5", secondary: "#E7F0FA", accent: "#E9C46A", background: "#F7FAFD", text: "#1E3350" },
    fontFamily: "Lora, Georgia, serif",
  },
  {
    banner: "emerald-arch",
    name: "Emerald Arch",
    eventTypes: ["Muslim Wedding"],
    colors: { primary: "#D4AF37", secondary: "#0B4D3B", accent: "#F1DFA0", background: "#F4FAF7", text: "#0B3A2D" },
    fontFamily: "Cormorant Garamond, Georgia, serif",
  },
  {
    banner: "dark-gold",
    name: "Dark Gold",
    eventTypes: [],
    colors: { primary: "#E8C36A", secondary: "#141009", accent: "#F3DDA0", background: "#0E0C09", text: "#F7F1E6" },
    fontFamily: "Cormorant Garamond, Georgia, serif",
  },
];

async function seedBannerThemes() {
  await connectMongo();

  const themeIds: string[] = [];
  for (const s of STARTERS) {
    const slug = `banner-${s.banner}`;
    const theme = await Theme.findOneAndUpdate(
      { slug },
      {
        $setOnInsert: {
          name: s.name,
          slug,
          status: ThemeStatus.ACTIVE,
          config: {
            layout: "event-banner",
            banner: s.banner,
            colors: s.colors,
            fontFamily: s.fontFamily,
            sections: LIVE_SECTIONS,
            eventTypes: s.eventTypes,
          },
        },
      },
      { upsert: true, new: true }
    );
    themeIds.push(String(theme!._id));
  }

  const vendors = await Vendor.find().select("_id").lean();
  const ops = vendors.flatMap((v: { _id: string }) =>
    themeIds.map((themeId) => ({
      updateOne: {
        filter: { vendorId: v._id, themeId },
        update: { $setOnInsert: { vendorId: v._id, themeId, isEnabled: true, isDefault: false } },
        upsert: true,
      },
    }))
  );
  if (ops.length) await VendorTheme.bulkWrite(ops);

  // eslint-disable-next-line no-console
  console.log(`Banner themes ready: ${themeIds.length}; enabled for ${vendors.length} vendor(s).`);
  await disconnectMongo();
}

seedBannerThemes().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
