import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Volume2, VolumeX, AlertTriangle, Navigation } from "lucide-react";
import MapView from "@/components/MapView";

const steps = [
  { instruction: "Head north on Road No. 12", distance: "350 m", icon: "↑" },
  { instruction: "Turn right onto Jubilee Hills Rd", distance: "1.2 km", icon: "→" },
  { instruction: "Take the ramp to ORR", distance: "450 m", icon: "↗" },
  { instruction: "Continue on ORR", distance: "18.5 km", icon: "↑" },
  { instruction: "Take exit toward Charminar", distance: "800 m", icon: "↙" },
  { instruction: "Arrive at Charminar", distance: "", icon: "📍" },
];

const ActiveNavigation = () => {
  const navigate = useNavigate();
  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  return (
    <div className="h-screen w-screen relative">
      <MapView userLocation={[17.385, 78.4867]} />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] bg-primary text-primary-foreground p-4 safe-top">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{steps[currentStep].icon}</span>
            <div>
              <p className="font-semibold text-sm">{steps[currentStep].instruction}</p>
              <p className="text-xs text-primary-foreground/70">{steps[currentStep].distance}</p>
            </div>
          </div>
          <button onClick={() => setMuted(!muted)} className="touch-target">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
        {currentStep + 1 < steps.length && (
          <div className="bg-primary-foreground/10 rounded-lg px-3 py-2 text-xs">
            Then: {steps[currentStep + 1].instruction}
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] bg-card p-4 safe-bottom">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-foreground">38 min</p>
            <p className="text-xs text-muted-foreground">24.2 km · ETA 10:42 AM</p>
          </div>
          <div className="flex gap-2">
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
