import { useState, useCallback } from "react";
import MapView from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import MapControls from "@/components/MapControls";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  const [userLocation, setUserLocation] = useState<[number, number] | undefined>();
  const [trafficOn, setTrafficOn] = useState(false);

  const handleLocate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true }
    );
  }, []);

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      <MapView userLocation={userLocation} />
      <SearchBar />
      <MapControls onLocate={handleLocate} trafficOn={trafficOn} onToggleTraffic={() => setTrafficOn(!trafficOn)} />

      {/* Quick Info Bottom Sheet */}
      <div className="fixed bottom-16 left-0 right-0 z-[400] px-4 pb-2">
        <div className="floating-card p-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground text-sm">Telangana Traffic Overview</h3>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
          <div className="flex gap-3">
            <TrafficBadge color="bg-traffic-free" label="Clear" count="124" />
            <TrafficBadge color="bg-traffic-moderate" label="Moderate" count="38" />
            <TrafficBadge color="bg-traffic-heavy" label="Heavy" count="12" />
            <TrafficBadge color="bg-traffic-severe" label="Severe" count="3" />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

const TrafficBadge = ({ color, label, count }: { color: string; label: string; count: string }) => (
  <div className="flex items-center gap-1.5">
    <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
    <div>
      <p className="text-xs font-medium text-foreground">{count}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  </div>
);

export default Index;
