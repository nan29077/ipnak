import { MapScreen } from "@/components/map/MapScreen";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const user = await getCurrentUser();
  return <MapScreen userId={user?.id} />;
}
