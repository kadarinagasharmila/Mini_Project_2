import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Volume2, VolumeX, AlertTriangle, Navigation, Star, Save } from "lucide-react";
import MapView from "@/components/MapView";
import { RouteResult } from "@/services/routingService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const ActiveNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as {
    route: RouteResult;
    destName: string;
    sourceName?: string;
    sourceCoords?: [number, number];
    destCoords?: [number, number];
    vehicle?: string;
  } | null;

  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [simPosition, setSimPosition] = useState<[number, number] | undefined>(undefined);
  const [elapsed, setElapsed] = useState(0);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const route = state?.route;
  const destName = state?.destName || "Destination";
  const sourceName = state?.sourceName || "Current Location";

  const steps = route?.steps || [
    { instruction: "Head toward destination", distance: "", duration: "", icon: "↑" },
    { instruction: `Arrive at ${destName}`, distance: "", duration: "", icon: "📍" },
  ];

  const totalDuration = route?.duration || 0;
  const totalDistance = route?.distance || 0;
  const remainingDuration = Math.max(0, totalDuration - elapsed);
  const eta = new Date(Date.now() + remainingDuration * 60000).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  // Voice announcement
  const speak = useCallback((text: string) => {
    if (muted || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.9;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [muted]);

  // Announce current step
  useEffect(() => {
    const step = steps[currentStep];
    if (step) {
      const msg = step.distance
        ? `In ${step.distance}, ${step.instruction}`
        : step.instruction;
      speak(msg);
    }
  }, [currentStep, speak]);

  // Simulate position along route geometry
  useEffect(() => {
    if (!route?.geometry?.length) return;
    setSimPosition(route.geometry[0]);

    const totalPoints = route.geometry.length;
    const intervalMs = (totalDuration * 60000) / totalPoints;
    const clampedInterval = Math.max(intervalMs, 1000); // at least 1s per point
    let pointIndex = 0;

    timerRef.current = setInterval(() => {
      pointIndex++;
      if (pointIndex >= totalPoints) {
        if (timerRef.current) clearInterval(timerRef.current);
        speak(`You have arrived at ${destName}`);
        return;
      }
      setSimPosition(route.geometry[pointIndex]);
      setElapsed((prev) => prev + clampedInterval / 60000);

      // Auto-advance steps based on progress
      const progress = pointIndex / totalPoints;
      const expectedStep = Math.min(
        Math.floor(progress * steps.length),
        steps.length - 1
      );
      setCurrentStep((prev) => Math.max(prev, expectedStep));
    }, clampedInterval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.speechSynthesis.cancel();
    };
  }, [route]);

  // Save to favorites
  const saveToFavorites = async () => {
    if (!user) {
      toast.error("Sign in to save favorites");
      return;
    }
    if (!state?.sourceCoords || !state?.destCoords) {
      toast.error("Route data missing");
      return;
    }

    const { error } = await supabase.from("favorite_routes").insert({
      user_id: user.id,
      name: `${sourceName} → ${destName}`,
      source_name: sourceName,
      source_coords: state.sourceCoords,
      dest_name: destName,
      dest_coords: state.destCoords,
      vehicle_type: state?.vehicle || "car",
    });

    if (error) {
      if (error.code === "23505") toast.info("Already saved!");
      else toast.error("Failed to save");
    } else {
      toast.success("Saved to favorites!");
    }
  };

  return (
    <div className="h-screen w-screen relative">
      <MapView
        userLocation={simPosition}
        routeCoords={route?.geometry}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] bg-primary text-primary-foreground p-4 safe-top">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{steps[currentStep]?.icon}</span>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{steps[currentStep]?.instruction}</p>
              <p className="text-xs text-primary-foreground/70">{steps[currentStep]?.distance}</p>
            </div>
          </div>
          <button onClick={() => setMuted(!muted)} className="touch-target shrink-0">
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
        {currentStep + 1 < steps.length && (
          <div className="bg-primary-foreground/10 rounded-lg px-3 py-2 text-xs truncate">
            Then: {steps[currentStep + 1]?.instruction}
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] bg-card p-4 safe-bottom">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-2xl font-bold text-foreground">
              {remainingDuration > 60
                ? `${Math.floor(remainingDuration / 60)}h ${Math.round(remainingDuration % 60)}min`
                : `${Math.round(remainingDuration)} min`}
            </p>
            <p className="text-xs text-muted-foreground">{totalDistance} km · ETA {eta}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={saveToFavorites}
              className="bg-warning text-warning-foreground px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Star className="w-3.5 h-3.5" /> Save
            </button>
            <button
              onClick={() => {
                window.speechSynthesis.cancel();
                if (timerRef.current) clearInterval(timerRef.current);
                navigate("/");
              }}
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
