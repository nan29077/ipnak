"use client";
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import { ACTIVE_MAP_PROVIDER, type LatLng, type MapMarker } from "@/lib/map";

function Recenter({ center }: { center: LatLng }) {
  const map = useMap();
  useEffect(() => { map.setView([center.lat, center.lng]); }, [center.lat, center.lng, map]);
  return null;
}

const COLORS: Record<string, string> = { current: "#2dd4bf", catch: "#243a63", listing: "#f59e0b" };

export default function MapCanvas({
  center, route = [], markers = [], zoom = 13, onMarkerClick,
}: {
  center: LatLng; route?: LatLng[]; markers?: MapMarker[]; zoom?: number;
  onMarkerClick?: (m: MapMarker) => void;
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} className="h-full w-full" scrollWheelZoom>
      <TileLayer url={ACTIVE_MAP_PROVIDER.tileUrl!} attribution={ACTIVE_MAP_PROVIDER.attribution} />
      <Recenter center={center} />

      {route.length > 1 && (
        <Polyline positions={route.map((p) => [p.lat, p.lng]) as any} pathOptions={{ color: "#2dd4bf", weight: 4, opacity: 0.85 }} />
      )}

      {markers.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.position.lat, m.position.lng]}
          radius={m.kind === "current" ? 9 : 8}
          pathOptions={{ color: "#fff", weight: 2, fillColor: COLORS[m.kind], fillOpacity: 1 }}
          eventHandlers={{ click: () => onMarkerClick?.(m) }}
        >
          {m.title && <Tooltip direction="top">{m.title}</Tooltip>}
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
