import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Volume2, VolumeX, AlertTriangle, Navigation } from "lucide-react";
import MapView from "@/components/MapView";
import { RouteResult } from "@/services/routingService";

const ActiveNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { route: RouteResult; destName: string } | null;
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const route = state?.route;
  const destName = state?.destName || "Destination";

  const steps = route?.steps || [
    { instruction: "Head toward destination", distance: "", duration: "", icon: "↑" },
    { instruction: `Arrive at ${destName}`, distance: "", duration: "", icon: "📍" },
  ];

  const totalDuration = route?.duration || 0;
  const totalDistance = route?.distance || 0;
  const eta = new Date(Date.now() + totalDuration * 60000).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  const startCoord = route?.geometry?.[0];

  return (
    <div className="h-screen w-screen relative">
      <MapView
        userLocation={startCoord}
        routeCoords={route?.geometry}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] bg-primary text-primary-foreground p-4 safe-top">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{steps[currentStep]?.icon}</span>
            <div>
              <p className="font-semibold text-sm">{steps[currentStep]?.instruction}</p>
              <p className="text-xs text-primary-foreground/70">{steps[currentStep]?.distance}</p>
            </div>
          </div>
          <button onClick={() => setMuted(!muted)} className="touch-target">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
        {currentStep + 1 < steps.length && (
          <div className="bg-primary-foreground/10 rounded-lg px-3 py-2 text-xs">
            Then: {steps[currentStep + 1]?.instruction}
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] bg-card p-4 safe-bottom">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-foreground">
              {totalDuration > 60 ? `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}min` : `${totalDuration} min`}
            </p>
            <p className="text-xs text-muted-foreground">{totalDistance} km · ETA {eta}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
              }}
              className="bg-primary text-primary-foreground px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" /> Next
            </button>
            <button className="bg-warning text-warning-foreground px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Report
            </button>
            <button
              onClick={() => navigate("/")}
              className="bg-destructive text-destructive-foreground px-4 py-2 rounded-lg text-xs font-semibold"
            >
              End
            </button>
          </div>
        </div>
        {/* Progress */}
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveNavigation;
