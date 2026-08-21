import { connectMongo, disconnectMongo } from "../src/config/mongo";
import { Theme, ThemeCategory } from "../src/models";
import { ThemeStatus } from "../src/types/enums";

async function seedThemes() {
  await connectMongo();
  const cats = await ThemeCategory.find().lean();
  const byName = new Map(cats.map((c: { name: string; _id: string }) => [c.name, c._id]));

  const themes = [
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
        colors: {
          primary: "#E8C36A",
          secondary: "#1A1208",
          accent: "#E8C36A",
          background: "#0B0908",
          text: "#F7F1E6",
        },
        fontFamily: "Cormorant Garamond, Georgia, serif",
      },
    },
    {
      name: "Traditional",
      slug: "traditional",
      category: "Traditional",
      config: {
        layout: "traditional",
        colors: {
          primary: "#8B1E3F",
          secondary: "#F5E6D3",
          accent: "#C9A227",
          background: "#2A0F18",
          text: "#F8EFE4",
        },
        fontFamily: "Playfair Display, Georgia, serif",
      },
    },
    {
      name: "Floral Rose",
      slug: "floral-rose",
      category: "Wedding",
      config: {
        layout: "floral",
        colors: {
          primary: "#C45C7A",
          secondary: "#FFE8F0",
          accent: "#E8A0B5",
          background: "#FFF7FA",
          text: "#4A2A35",
        },
        fontFamily: "Great Vibes, cursive",
      },
    },
    {
      name: "Classic Light",
      slug: "classic-light",
      category: "General",
      config: {
        layout: "classic",
        colors: {
          primary: "#1F4B7A",
          secondary: "#EEF3F8",
          accent: "#C9A227",
          background: "#F7F9FC",
          text: "#1B2430",
        },
        fontFamily: "Lora, Georgia, serif",
      },
    },
  ];

  for (const t of themes) {
    await Theme.findOneAndUpdate(
      { slug: t.slug },
      {
        name: t.name,
        slug: t.slug,
        categoryId: byName.get(t.category) ?? null,
        config: t.config,
        status: ThemeStatus.ACTIVE,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  const all = await Theme.find({ status: ThemeStatus.ACTIVE }).select("name slug status").lean();
  console.log(
    "Active themes:",
    all.map((t: { name: string; slug: string }) => `${t.name} (${t.slug})`).join(", ")
  );
  await disconnectMongo();
}

seedThemes().catch((err) => {
  console.error(err);
  process.exit(1);
});
