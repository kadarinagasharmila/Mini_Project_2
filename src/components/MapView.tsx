import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

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

// Hyderabad center
const HYDERABAD_CENTER: [number, number] = [17.385, 78.4867];

const LocationMarker = ({ position }: { position?: [number, number] }) => {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, 14);
    }
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
    if (bounds) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

interface MapViewProps {
  userLocation?: [number, number];
  className?: string;
  routeCoords?: [number, number][];
  destination?: [number, number];
  bounds?: L.LatLngBoundsExpression;
}

const MapView = ({ userLocation, className = "", routeCoords, destination, bounds }: MapViewProps) => {
  const destIcon = L.divIcon({
    className: "custom-marker",
    html: `<div style="width:16px;height:16px;background:hsl(0,72%,51%);border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

  return (
    <MapContainer
      center={userLocation || HYDERABAD_CENTER}
      zoom={12}
      className={`w-full h-full ${className}`}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={20}
        subdomains="abcd"
      />
      <LocationMarker position={userLocation} />
      {destination && (
        <Marker position={destination} icon={destIcon}>
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
    </MapContainer>
  );
};

export default MapView;
