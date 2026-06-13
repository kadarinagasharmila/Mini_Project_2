import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { useEffect, useState } from "react";
import { getLiveTrafficIncidents, TrafficIncident } from "@/services/routingService";

// Fix default marker icon
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const HYDERABAD_CENTER: [number, number] = [17.385, 78.4867];

const INCIDENT_COLORS: Record<string, string> = {
  accident: "#ef4444",
  construction: "#f97316",
  closure: "#991b1b",
  congestion: "#f59e0b",
  police: "#3b82f6",
  flood: "#06b6d4",
  pothole: "#eab308",
  other: "#8b5cf6",
};

const INCIDENT_LABELS: Record<string, string> = {
  accident: "🚨 Accident",
  construction: "🚧 Construction",
  closure: "⛔ Road closure",
  congestion: "🚗 Congestion",
  police: "👮 Police",
  flood: "🌊 Flooding",
  pothole: "⚠️ Pothole",
  other: "📍 Incident",
};

const InvalidateSize = () => {
  const map = useMap();
  useEffect(() => {
    const invalidate = () => {
      try {
        map.invalidateSize();
      } catch {
        // Leaflet can throw if a delayed resize lands after unmount.
      }
    };
    const shortTimer = window.setTimeout(invalidate, 100);
    const longTimer = window.setTimeout(invalidate, 500);
    const handleResize = () => invalidate();
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(shortTimer);
      window.clearTimeout(longTimer);
      window.removeEventListener("resize", handleResize);
    };
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
    className: "user-marker-icon",
    html: `<div class="user-marker-dot"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
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
  alternateRouteCoords?: [number, number][][];
  destination?: [number, number];
  bounds?: L.LatLngBoundsExpression;
  showIncidents?: boolean;
}

const destIconObj = L.divIcon({
  className: "dest-marker-icon",
  html: `<div class="dest-marker-dot"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const SAMPLE_INCIDENTS: TrafficIncident[] = [
  {
    id: "demo-1",
    type: "construction",
    description: "Road narrowing reported near HITEC City flyover.",
    latitude: 17.4435,
    longitude: 78.3772,
    severity: "medium",
    created_at: new Date().toISOString(),
    source: "sample",
  },
  {
    id: "demo-2",
    type: "pothole",
    description: "Rough patch noted on inner road approaching Ameerpet.",
    latitude: 17.4374,
    longitude: 78.4482,
    severity: "low",
    created_at: new Date().toISOString(),
    source: "sample",
  },
];

const IncidentMarkers = ({ enabled }: { enabled: boolean }) => {
  const [incidents, setIncidents] = useState<TrafficIncident[]>(SAMPLE_INCIDENTS);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const loadIncidents = async () => {
      try {
        const liveIncidents = await getLiveTrafficIncidents({
          bbox: { minLat: 17.18, minLng: 78.25, maxLat: 17.6, maxLng: 78.65 },
          limit: 70,
        });

        if (!cancelled) {
          setIncidents(liveIncidents.length ? liveIncidents : SAMPLE_INCIDENTS);
        }
      } catch (error) {
        if (!cancelled) setIncidents(SAMPLE_INCIDENTS);
      }
    };

    loadIncidents();
    const intervalId = window.setInterval(loadIncidents, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled]);

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
              <p className="text-muted-foreground capitalize">Source: {inc.source}</p>
              {inc.delaySeconds ? (
                <p className="text-muted-foreground">Delay: {Math.round(inc.delaySeconds / 60)} min</p>
              ) : null}
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

const MapView = ({
  userLocation,
  className = "",
  routeCoords,
  alternateRouteCoords = [],
  destination,
  bounds,
  showIncidents = true,
}: MapViewProps) => {
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
      {alternateRouteCoords.map((coords, index) => (
        coords.length > 0 && (
          <Polyline
            key={`alternate-casing-${index}`}
            positions={coords}
            pathOptions={{ color: "#ffffff", weight: 8, opacity: 0.9 }}
            className="route-line route-line-casing"
          />
        )
      ))}
      {alternateRouteCoords.map((coords, index) => (
        coords.length > 0 && (
          <Polyline
            key={`alternate-route-${index}`}
            positions={coords}
            pathOptions={{ color: "#6b7280", weight: 5, opacity: 0.82 }}
            className="route-line route-line-alternate"
          />
        )
      ))}
      {routeCoords && routeCoords.length > 0 && (
        <>
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#0f172a", weight: 11, opacity: 0.2 }}
            className="route-line route-line-shadow"
          />
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.95 }}
            className="route-line route-line-casing"
          />
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: "#1a73e8", weight: 6, opacity: 1 }}
            className="route-line route-line-main"
          />
        </>
      )}
      {bounds && <FitBounds bounds={bounds} />}
      {showIncidents && <IncidentMarkers enabled={showIncidents} />}
    </MapContainer>
  );
};

export default MapView;
