import { useState, useCallback, useEffect } from "react";
import MapView from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import MapControls from "@/components/MapControls";

import { getTrafficCounts, predictTrafficForArea } from "@/services/trafficPrediction";
import { Sparkles } from "lucide-react";

const Index = () => {
  const [userLocation, setUserLocation] = useState<[number, number] | undefined>();
  const [trafficOn, setTrafficOn] = useState(false);
  const [trafficData, setTrafficData] = useState(getTrafficCounts());
  const [aiInsight, setAiInsight] = useState("");

  useEffect(() => {
    const prediction = predictTrafficForArea();
    setAiInsight(prediction.suggestion);
    setTrafficData(getTrafficCounts());

    const interval = setInterval(() => {
      setTrafficData(getTrafficCounts());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

      {/* AI Traffic Bottom Sheet */}
      <div className="fixed bottom-16 left-0 right-0 z-[400] px-4 pb-2">
        <div className="floating-card p-4 max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <h3 className="font-semibold text-foreground text-sm">AI Traffic Prediction</h3>
            </div>
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
          {aiInsight && (
            <p className="text-xs text-muted-foreground mb-2">{aiInsight}</p>
          )}
          <div className="flex gap-3">
            <TrafficBadge color="bg-traffic-free" label="Clear" count={String(trafficData.clear)} />
            <TrafficBadge color="bg-traffic-moderate" label="Moderate" count={String(trafficData.moderate)} />
            <TrafficBadge color="bg-traffic-heavy" label="Heavy" count={String(trafficData.heavy)} />
            <TrafficBadge color="bg-traffic-severe" label="Severe" count={String(trafficData.severe)} />
          </div>
        </div>
      </div>

      
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
