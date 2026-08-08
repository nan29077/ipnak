import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MarketEditForm } from "@/components/market/MarketEditForm";

export const dynamic = "force-dynamic";

export default async function MarketEditPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const listing = await prisma.marketListing.findUnique({
    where: { id: params.id },
    select: {
      id: true, sellerId: true, title: true, category: true, condition: true,
      tradeMethod: true, price: true, region: true, description: true,
    },
  });
  if (!listing) notFound();
  if (listing.sellerId !== user.id) redirect(`/market/${params.id}`);

  return (
    <MarketEditForm
      listingId={listing.id}
      initial={{
        title: listing.title,
        category: listing.category,
        condition: listing.condition,
        tradeMethod: listing.tradeMethod,
        price: listing.price,
        region: listing.region,
        description: listing.description,
      }}
    />
  );
}
