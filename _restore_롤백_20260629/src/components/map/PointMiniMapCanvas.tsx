"use client";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { ACTIVE_MAP_PROVIDER } from "@/lib/map";

export default function PointMiniMapCanvas({
  lat, lng, label, zoom = 12,
}: { lat: number; lng: number; label?: string; zoom?: number }) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      className="h-full w-full"
      scrollWheelZoom={false}
      doubleClickZoom={false}
      dragging={true}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={ACTIVE_MAP_PROVIDER.tileUrl!} attribution={ACTIVE_MAP_PROVIDER.attribution} />
      <CircleMarker
        center={[lat, lng]}
        radius={9}
        pathOptions={{ color: "#fff", weight: 2, fillColor: "#f97316", fillOpacity: 1 }}
      >
        {label && <Tooltip direction="top">{label}</Tooltip>}
      </CircleMarker>
    </MapContainer>
  );
}
