/**
 * Switches the catalog to the 12 "showcase" live-stream themes:
 *   1. creates them (or re-activates them) and enables them for every vendor;
 *   2. sets every other theme to INACTIVE, so vendors no longer see it.
 *
 * Nothing is deleted: events already using an old theme keep rendering with it, and an old
 * theme can be re-activated from the admin panel at any time.
 *
 *   npm run themes:showcase -- --dry-run   # show what would change
 *   npm run themes:showcase                # apply
 *
 * Styles/artwork live in the frontends (themes/lib/showcase-presets.ts).
 */
import { connectMongo, disconnectMongo } from "../src/config/mongo";
import { Theme, Vendor, VendorTheme } from "../src/models";
import { ThemeStatus } from "../src/types/enums";

const DRY_RUN = process.argv.includes("--dry-run");

const LIVE_SECTIONS = {
  showCountdown: true,
  showGallery: true,
  showSubEvents: false,
  showLivePlayer: true,
  showInvitationCard: false,
  showCouplePhotos: false,
};

const SERIF_CAPS = "Cinzel, 'Cormorant Garamond', Georgia, serif";
const SANS = "Montserrat, 'Helvetica Neue', Arial, sans-serif";

type Colors = { primary: string; secondary: string; accent: string; background: string; text: string };
const SHOWCASE: { key: string; name: string; eventTypes: string[]; colors: Colors; fontFamily: string }[] = [
  { key: "royal-wedding", name: "Royal Wedding", eventTypes: ["Marriage", "Marriage-Events", "Engagement", "Reception", "Muslim Wedding"], colors: { primary: "#B8862B", secondary: "#C9A24A", accent: "#7A1F1F", background: "#F8EFDC", text: "#5B4632" }, fontFamily: SERIF_CAPS },
  { key: "cinematic-black", name: "Cinematic Black", eventTypes: [], colors: { primary: "#F2F2F2", secondary: "#8C8C8C", accent: "#BDBDBD", background: "#0A0A0A", text: "#D6D6D6" }, fontFamily: SERIF_CAPS },
  { key: "luxury-gold", name: "Luxury Gold", eventTypes: ["Marriage", "Reception", "Engagement", "Muslim Wedding", "Shastipoorthi"], colors: { primary: "#E2B65A", secondary: "#C9973A", accent: "#E8CF95", background: "#0B0906", text: "#E9DFC7" }, fontFamily: SERIF_CAPS },
  { key: "floral-romance", name: "Floral Romance", eventTypes: ["Engagement", "Reception", "Marriage", "Baby Shower", "Birthday", "Half Saree"], colors: { primary: "#C2566E", secondary: "#E59AAB", accent: "#B4677A", background: "#FCEFEC", text: "#6A4650" }, fontFamily: SERIF_CAPS },
  { key: "traditional-indian", name: "Traditional Indian", eventTypes: ["Marriage", "Marriage-Events", "Upanayanam", "Dhothi Ceremony", "Half Saree", "Shastipoorthi"], colors: { primary: "#E7B95A", secondary: "#C9973A", accent: "#F1D9A0", background: "#4E0B12", text: "#F3E2C4" }, fontFamily: SERIF_CAPS },
  { key: "temple-classic", name: "Temple Classic", eventTypes: ["Devotional", "Padi Pooja", "Gruhapravesham", "Seemantham", "Namakarana", "Cradle Ceremony", "Upanayanam"], colors: { primary: "#9B1B1B", secondary: "#C9973A", accent: "#8A5A1A", background: "#FBF2E1", text: "#5A3A1E" }, fontFamily: SERIF_CAPS },
  { key: "modern-glass", name: "Modern Glass", eventTypes: [], colors: { primary: "#FFFFFF", secondary: "#9DB4FF", accent: "#C9D6FF", background: "#0B1530", text: "#DCE4FF" }, fontFamily: SANS },
  { key: "neon-night", name: "Neon Night", eventTypes: ["Sangeeth", "Birthday", "General Event", "Reunion"], colors: { primary: "#FF3DF0", secondary: "#B44DFF", accent: "#7FE7FF", background: "#08051A", text: "#E6DCFF" }, fontFamily: SANS },
  { key: "minimal-white", name: "Minimal White", eventTypes: [], colors: { primary: "#2B2B2B", secondary: "#2B2B2B", accent: "#8A8A8A", background: "#F7F5F0", text: "#4A4A4A" }, fontFamily: SANS },
  { key: "concert-energy", name: "Concert Energy", eventTypes: ["General Event", "Sangeeth", "Birthday", "Reunion"], colors: { primary: "#FFFFFF", secondary: "#C04BFF", accent: "#E7B8FF", background: "#14042B", text: "#EBDDFF" }, fontFamily: SANS },
  { key: "corporate-premium", name: "Corporate Premium", eventTypes: ["General Event", "Retirement", "Reunion"], colors: { primary: "#D4A84B", secondary: "#D4A84B", accent: "#A9C1E8", background: "#0B1F3A", text: "#D7E2F3" }, fontFamily: SERIF_CAPS },
  { key: "broadcast-pro", name: "Broadcast Pro", eventTypes: [], colors: { primary: "#FFFFFF", secondary: "#1E5BD8", accent: "#9EB8E8", background: "#081226", text: "#D5E0F5" }, fontFamily: SANS },
];

async function applyShowcaseThemes() {
  await connectMongo();
  const slugs = SHOWCASE.map((s) => `showcase-${s.key}`);

  const toDeactivate = await Theme.find({ slug: { $nin: slugs }, status: { $ne: ThemeStatus.INACTIVE } })
    .select("name slug status")
    .lean();
  const vendors = await Vendor.find().select("_id").lean();

  // eslint-disable-next-line no-console
  console.log(
    `${DRY_RUN ? "[dry run] " : ""}Showcase themes: ${slugs.length} · vendors: ${vendors.length}\n` +
      `Will set INACTIVE (${toDeactivate.length}): ${toDeactivate.map((t: { name: string }) => t.name).join(", ") || "none"}`
  );
  if (DRY_RUN) {
    await disconnectMongo();
    return;
  }

  const themeIds: string[] = [];
  for (const s of SHOWCASE) {
    const slug = `showcase-${s.key}`;
    const theme = await Theme.findOneAndUpdate(
      { slug },
      {
        $set: { status: ThemeStatus.ACTIVE },
        $setOnInsert: {
          name: s.name,
          slug,
          config: {
            layout: "showcase",
            showcase: s.key,
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

  if (toDeactivate.length) {
    await Theme.updateMany(
      { _id: { $in: toDeactivate.map((t: { _id: string }) => t._id) } },
      { $set: { status: ThemeStatus.INACTIVE } }
    );
  }

  const ops = vendors.flatMap((v: { _id: string }) =>
    themeIds.map((themeId) => ({
      updateOne: {
        filter: { vendorId: v._id, themeId },
        update: { $set: { isEnabled: true }, $setOnInsert: { vendorId: v._id, themeId, isDefault: false } },
        upsert: true,
      },
    }))
  );
  if (ops.length) await VendorTheme.bulkWrite(ops);

  // eslint-disable-next-line no-console
  console.log(`Done: ${themeIds.length} showcase themes active for ${vendors.length} vendor(s); ${toDeactivate.length} old theme(s) set INACTIVE.`);
  await disconnectMongo();
}

applyShowcaseThemes().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
