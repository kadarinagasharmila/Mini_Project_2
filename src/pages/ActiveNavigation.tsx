import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Volume2, VolumeX, Star, MapPin, Locate } from "lucide-react";
import MapView from "@/components/MapView";
import { RouteResult } from "@/services/routingService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Haversine distance in meters
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Find closest step index based on position
function findClosestStep(pos: [number, number], geometry: [number, number][], totalSteps: number): number {
  let minDist = Infinity;
  let closestIdx = 0;
  for (let i = 0; i < geometry.length; i++) {
    const d = haversineM(pos, geometry[i]);
    if (d < minDist) { minDist = d; closestIdx = i; }
  }
  const progress = closestIdx / geometry.length;
  return Math.min(Math.floor(progress * totalSteps), totalSteps - 1);
}

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
  const [gpsPosition, setGpsPosition] = useState<[number, number] | undefined>(undefined);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);
  const lastSpokenStepRef = useRef(-1);

  const route = state?.route;
  const destName = state?.destName || "Destination";
  const sourceName = state?.sourceName || "Current Location";
  const vehicle = state?.vehicle || "car";

  const steps = route?.steps || [
    { instruction: "Head toward destination", distance: "", duration: "", icon: "↑" },
    { instruction: `Arrive at ${destName}`, distance: "", duration: "", icon: "📍" },
  ];

  const totalDuration = route?.duration || 0;
  const totalDistance = route?.distance || 0;

  // Calculate remaining distance/time based on GPS progress
  const remainingDistance = Math.max(0, totalDistance - distanceTraveled);
  const avgSpeed = totalDistance > 0 ? totalDuration / totalDistance : 1; // min per km
  const remainingDuration = Math.max(0, Math.round(remainingDistance * avgSpeed));
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

  // Announce step changes
  useEffect(() => {
    if (currentStep === lastSpokenStepRef.current) return;
    lastSpokenStepRef.current = currentStep;
    const step = steps[currentStep];
    if (step) {
      const msg = step.distance
        ? `In ${step.distance}, ${step.instruction}`
        : step.instruction;
      speak(msg);
    }
  }, [currentStep, speak, steps]);

  // Real GPS tracking
  useEffect(() => {
    if (!route?.geometry?.length) return;

    // Set initial position to route start
    setGpsPosition(route.geometry[0]);

    if (!navigator.geolocation) {
      toast.error("GPS not available on this device");
      return;
    }

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setGpsPosition(newPos);
        setGpsAccuracy(pos.coords.accuracy);
        setGpsActive(true);

        // Track distance traveled
        if (lastPosRef.current) {
          const moved = haversineM(lastPosRef.current, newPos);
          if (moved > 5 && moved < 500) { // filter noise (>5m) and teleports (<500m)
            setDistanceTraveled((prev) => prev + moved / 1000);
          }
        }
        lastPosRef.current = newPos;

        // Update current step based on proximity to route
        if (route.geometry.length > 0) {
          const newStep = findClosestStep(newPos, route.geometry, steps.length);
          setCurrentStep((prev) => Math.max(prev, newStep));

          // Check if arrived (within 50m of destination)
          const destDist = haversineM(newPos, route.geometry[route.geometry.length - 1]);
          if (destDist < 50) {
            speak(`You have arrived at ${destName}`);
            toast.success(`Arrived at ${destName}!`);
          }
        }
      },
      (err) => {
        console.warn("GPS error:", err.message);
        if (err.code === 1) {
          toast.error("Location access denied. Enable GPS for real-time tracking.");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    speak(`Starting navigation to ${destName}. ${vehicle === "bus" ? "Bus route" : vehicle === "bike" ? "Cycling route" : vehicle === "walk" ? "Walking route" : "Driving"} — ${totalDuration} minutes, ${totalDistance} kilometers.`);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
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
      vehicle_type: vehicle,
    });

    if (error) {
      if (error.code === "23505") toast.info("Already saved!");
      else toast.error("Failed to save");
    } else {
      toast.success("Saved to favorites!");
    }
  };

  const vehicleEmoji = vehicle === "bus" ? "🚌" : vehicle === "bike" ? "🚲" : vehicle === "walk" ? "🚶" : "🚗";

  return (
    <div className="h-screen w-screen relative">
      <MapView
        userLocation={gpsPosition}
        routeCoords={route?.geometry}
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-[500] bg-primary text-primary-foreground p-4 safe-top">
        <div className="flex items-center justify-between mb-2">
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
        {/* GPS Status */}
        <div className="flex items-center gap-2 mt-2 text-xs text-primary-foreground/60">
          <Locate className={`w-3 h-3 ${gpsActive ? "text-green-300" : "text-primary-foreground/40"}`} />
          <span>
            {gpsActive
              ? `GPS active · ${gpsAccuracy ? `±${Math.round(gpsAccuracy)}m` : "Tracking"}`
              : "Waiting for GPS..."}
          </span>
          <span className="ml-auto">{vehicleEmoji} {vehicle.charAt(0).toUpperCase() + vehicle.slice(1)}</span>
        </div>
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
            <p className="text-xs text-muted-foreground">
              {remainingDistance.toFixed(1)} km left · ETA {eta}
            </p>
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
                if (watchIdRef.current !== null) {
                  navigator.geolocation.clearWatch(watchIdRef.current);
                }
                window.speechSynthesis.cancel();
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
            style={{ width: `${totalDistance > 0 ? Math.min(100, (distanceTraveled / totalDistance) * 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ActiveNavigation;
