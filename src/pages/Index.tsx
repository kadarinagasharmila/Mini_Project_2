import { useState, useCallback, useEffect } from "react";
import MapView from "@/components/MapView";
import SearchBar from "@/components/SearchBar";
import MapControls from "@/components/MapControls";
import ReportIncidentSheet from "@/components/ReportIncidentSheet";

import { getTrafficCounts, predictTrafficForArea } from "@/services/trafficPrediction";
import { Activity, Sparkles } from "lucide-react";

const Index = () => {
  const [userLocation, setUserLocation] = useState<[number, number] | undefined>();
  const [trafficOn, setTrafficOn] = useState(false);
  const [trafficData, setTrafficData] = useState(getTrafficCounts());
  const [aiInsight, setAiInsight] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

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
      <MapView userLocation={userLocation} showIncidents={trafficOn} />
      <div className="map-scrim absolute inset-0 z-[250]" />
      <SearchBar />
      <MapControls
        onLocate={handleLocate}
        trafficOn={trafficOn}
        onToggleTraffic={() => setTrafficOn(!trafficOn)}
        onReportIncident={() => setReportOpen(true)}
      />
      <ReportIncidentSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        location={userLocation}
      />

      {/* AI Traffic Bottom Sheet */}
      <div className="fixed bottom-16 left-0 right-0 z-[400] px-4 pb-2">
        <div className="floating-card max-w-lg mx-auto overflow-hidden">
          <div className="border-b border-border/70 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">Traffic Outlook</h3>
                  <p className="text-[11px] text-muted-foreground">Hyderabad live conditions</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
                <Activity className="h-3 w-3" />
                Live
              </span>
            </div>
          </div>
          <div className="px-4 py-3">
            {aiInsight && (
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{aiInsight}</p>
            )}
          <div className="grid grid-cols-4 gap-2">
            <TrafficBadge color="bg-traffic-free" label="Clear" count={String(trafficData.clear)} />
            <TrafficBadge color="bg-traffic-moderate" label="Moderate" count={String(trafficData.moderate)} />
            <TrafficBadge color="bg-traffic-heavy" label="Heavy" count={String(trafficData.heavy)} />
            <TrafficBadge color="bg-traffic-severe" label="Severe" count={String(trafficData.severe)} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

const TrafficBadge = ({ color, label, count }: { color: string; label: string; count: string }) => (
  <div className="stat-chip text-center">
    <div className={`mx-auto mb-1 h-2 w-7 rounded-full ${color}`} />
    <p className="text-sm font-bold text-foreground">{count}</p>
    <p className="truncate text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default Index;
