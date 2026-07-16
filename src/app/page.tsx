import { getCurrentUser } from "@/lib/auth";
import { getFeedPosts } from "@/lib/queries";
import { prisma } from "@/lib/prisma";
import { CurationHome } from "@/components/CurationHome";
import { getMainSections } from "@/lib/curation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  const [feedPosts, sections, bannerRows] = await Promise.all([
    getFeedPosts(user?.id, { kind: "FEED" }),
    getMainSections(10),
    prisma.banner.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
  ]);

  return (
    <CurationHome
      feedPosts={feedPosts}
      sections={sections}
      banners={bannerRows.map((b) => ({ title: b.title, imageUrl: b.imageUrl }))}
      currentUserId={user?.id}
    />
  );
}
