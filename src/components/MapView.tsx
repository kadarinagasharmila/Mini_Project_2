import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Fix default marker icon
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const HYDERABAD_CENTER: [number, number] = [17.385, 78.4867];

interface Incident {
  id: string;
  type: string;
  description: string | null;
  latitude: number;
  longitude: number;
  severity: string;
  created_at: string;
}

const INCIDENT_COLORS: Record<string, string> = {
  accident: "#ef4444",
  construction: "#f97316",
  police: "#3b82f6",
  flood: "#06b6d4",
  pothole: "#eab308",
  other: "#8b5cf6",
};

const INCIDENT_LABELS: Record<string, string> = {
  accident: "🚨 Accident",
  construction: "🚧 Construction",
  police: "👮 Police",
  flood: "🌊 Flooding",
  pothole: "⚠️ Pothole",
  other: "📍 Incident",
};

const InvalidateSize = () => {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
    setTimeout(() => map.invalidateSize(), 500);
    const handleResize = () => map.invalidateSize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [map]);
  return null;
};

const LocationMarker = ({ position }: { position?: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 14);
  }, [position, map]);
  if (!position) return null;

  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width:16px;height:16px;background:hsl(217,91%,53%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <Marker position={position} icon={icon}>
      <Popup>Your Location</Popup>
    </Marker>
  );
};

const FitBounds = ({ bounds }: { bounds?: L.LatLngBoundsExpression }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [50, 50] });
  }, [bounds, map]);
  return null;
};

interface MapViewProps {
  userLocation?: [number, number];
  className?: string;
  routeCoords?: [number, number][];
  destination?: [number, number];
  bounds?: L.LatLngBoundsExpression;
  showIncidents?: boolean;
}

const destIconObj = L.divIcon({
  className: "custom-marker",
  html: `<div style="width:16px;height:16px;background:hsl(0,72%,51%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const IncidentMarkers = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    // Fetch existing incidents
    const fetchIncidents = async () => {
      const { data } = await supabase
        .from("traffic_incidents")
        .select("*")
        .gte("expires_at", new Date().toISOString());
      if (data) setIncidents(data as Incident[]);
    };
    fetchIncidents();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("incidents-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "traffic_incidents" },
        () => fetchIncidents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <>
      {incidents.map((inc) => (
        <CircleMarker
          key={inc.id}
          center={[inc.latitude, inc.longitude]}
          radius={inc.severity === "high" ? 12 : inc.severity === "medium" ? 9 : 6}
          pathOptions={{
            color: INCIDENT_COLORS[inc.type] || INCIDENT_COLORS.other,
            fillColor: INCIDENT_COLORS[inc.type] || INCIDENT_COLORS.other,
            fillOpacity: 0.6,
            weight: 2,
          }}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-semibold">{INCIDENT_LABELS[inc.type] || inc.type}</p>
              {inc.description && <p className="mt-1">{inc.description}</p>}
              <p className="text-muted-foreground mt-1 capitalize">Severity: {inc.severity}</p>
              <p className="text-muted-foreground">
                {new Date(inc.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  );
};

const MapView = ({ userLocation, className = "", routeCoords, destination, bounds, showIncidents = true }: MapViewProps) => {
  return (
    <MapContainer
      center={userLocation || HYDERABAD_CENTER}
      zoom={12}
      style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      className={className}
      zoomControl={false}
      attributionControl={false}
    >
      <InvalidateSize />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={20}
        subdomains="abcd"
      />
      <LocationMarker position={userLocation} />
      {destination && (
        <Marker position={destination} icon={destIconObj}>
          <Popup>Destination</Popup>
        </Marker>
      )}
      {routeCoords && routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{ color: "hsl(217,91%,53%)", weight: 5, opacity: 0.8 }}
        />
      )}
      {bounds && <FitBounds bounds={bounds} />}
      {showIncidents && <IncidentMarkers />}
    </MapContainer>
  );
};

export default MapView;
