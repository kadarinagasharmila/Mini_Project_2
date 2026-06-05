import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Volume2, VolumeX, Star, MapPin, Locate, Navigation, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import MapView from "@/components/MapView";
import { RouteResult, WeatherData } from "@/services/routingService";
import { toast } from "sonner";

// Haversine distance in meters
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

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
  const state = location.state as {
    route: RouteResult;
    destName: string;
    sourceName?: string;
    sourceCoords?: [number, number];
    destCoords?: [number, number];
    vehicle?: string;
    weather?: WeatherData | null;
  } | null;

  const [muted, setMuted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [gpsPosition, setGpsPosition] = useState<[number, number] | undefined>(undefined);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(state?.route ?? null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);
  const lastSpokenStepRef = useRef(-1);
  const arrivedRef = useRef(false);

  const route = activeRoute;
  const destName = state?.destName || "Destination";
  const sourceName = state?.sourceName || "Current Location";
  const vehicle = state?.vehicle || "car";
  const weather = state?.weather;

  useEffect(() => {
    setActiveRoute(state?.route ?? null);
  }, [state?.route]);

  const steps = useMemo(
    () =>
      route?.steps || [
        { instruction: "Head toward destination", distance: "", duration: "", icon: "↑" },
        { instruction: `Arrive at ${destName}`, distance: "", duration: "", icon: "📍" },
      ],
    [destName, route?.steps]
  );

  const totalDuration = route?.duration || 0;
  const totalDistance = route?.distance || 0;

  const remainingDistance = Math.max(0, totalDistance - distanceTraveled);
  const avgSpeed = totalDistance > 0 ? totalDuration / totalDistance : 1;
  const remainingDuration = Math.max(0, Math.round(remainingDistance * avgSpeed));
  const eta = new Date(Date.now() + remainingDuration * 60000).toLocaleTimeString("en-IN", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  // Voice announcement - define first
  const speak = useCallback((text: string) => {
    if (muted || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [muted]);

  // Reroute function - uses speak
  const reroute = useCallback(async (currentPos: [number, number]) => {
    if (!route) return;
    try {
      const { getRoute } = await import("@/services/routingService");
      const destPoint = route.geometry[route.geometry.length - 1];
      const newRoutes = await getRoute(currentPos, destPoint, vehicle);
      if (newRoutes.length > 0) {
        setActiveRoute(newRoutes[0]);
        setCurrentStep(0);
        setDistanceTraveled(0);
        lastPosRef.current = currentPos;
        lastSpokenStepRef.current = -1;
        speak("Rerouting due to deviation from planned route.");
        toast.info("Rerouting...");
      }
    } catch (error) {
      console.error("Reroute failed:", error);
    }
  }, [route, vehicle, speak]);

  // Announce step changes
  useEffect(() => {
    if (currentStep === lastSpokenStepRef.current) return;
    lastSpokenStepRef.current = currentStep;
    const step = steps[currentStep];
    if (step) {
      let msg = step.distance
        ? `In ${step.distance}, ${step.instruction}`
        : step.instruction;

      // Add transit details for bus mode
      if (step.transitDetails) {
        const td = step.transitDetails;
        if (td.lineName) msg += `. Take ${td.vehicleType || "bus"} number ${td.lineName}`;
        if (td.departureStop) msg += ` from ${td.departureStop}`;
        if (td.arrivalStop) msg += ` to ${td.arrivalStop}`;
        if (td.numStops) msg += `. ${td.numStops} stops.`;
      }

      speak(msg);
    }
  }, [currentStep, speak, steps]);

  // Real GPS tracking
  useEffect(() => {
    if (!route?.geometry?.length) return;

    setGpsPosition(route.geometry[0]);

    if (!navigator.geolocation) {
      toast.error("GPS not available on this device");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setGpsPosition(newPos);
        setGpsAccuracy(pos.coords.accuracy);
        setGpsActive(true);

        if (lastPosRef.current) {
          const moved = haversineM(lastPosRef.current, newPos);
          if (moved > 5 && moved < 500) {
            setDistanceTraveled((prev) => prev + moved / 1000);
          }
        }
        lastPosRef.current = newPos;

        if (route.geometry.length > 0) {
          const newStep = findClosestStep(newPos, route.geometry, steps.length);
          setCurrentStep((prev) => Math.max(prev, newStep));

          const destDist = haversineM(newPos, route.geometry[route.geometry.length - 1]);
          if (destDist < 50 && !arrivedRef.current) {
            arrivedRef.current = true;
            speak(`You have arrived at ${destName}. ${weather ? `Current weather: ${weather.temperature} degrees, ${weather.condition}.` : ""}`);
            toast.success(`Arrived at ${destName}!`);
          }

          // Check for deviation and reroute if needed
          const closestDist = haversineM(newPos, route.geometry[newStep]);
          if (closestDist > 200 && !arrivedRef.current) { // More than 200m off route
            reroute(newPos);
          }
        }
      },
      (err) => {
        console.warn("GPS error:", err.message);
        if (err.code === 1) {
          toast.error("Location access denied. Enable GPS for real-time tracking.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );

    // Welcome announcement with weather + vehicle context
    const vehicleLabel = vehicle === "bus" ? "Bus route" : vehicle === "bike" ? "Two-wheeler route" : vehicle === "walk" ? "Walking route" : "Driving";
    let welcomeMsg = `Starting navigation to ${destName}. ${vehicleLabel} — ${totalDuration} minutes, ${totalDistance} kilometers.`;
    if (weather) {
      welcomeMsg += ` Weather at destination: ${weather.temperature} degrees, ${weather.condition}.`;
      if (weather.drivingWarning) {
        welcomeMsg += ` Warning: ${weather.drivingWarning}`;
      }
    }
    speak(welcomeMsg);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      window.speechSynthesis.cancel();
    };
  }, [destName, reroute, route, speak, steps.length, totalDistance, totalDuration, vehicle, weather]);

  const saveToFavorites = () => {
    if (!state?.sourceCoords || !state?.destCoords) {
      toast.error("Route data missing");
      return;
    }

    const favorites = JSON.parse(localStorage.getItem("routeMaxFavorites") || "[]") as Array<Record<string, unknown>>;
    const nextFavorite = {
      id: `${state.sourceCoords.join(",")}-${state.destCoords.join(",")}-${vehicle}`,
      name: `${sourceName} → ${destName}`,
      source_name: sourceName,
      source_coords: state.sourceCoords,
      dest_name: destName,
      dest_coords: state.destCoords,
      vehicle_type: vehicle,
      created_at: new Date().toISOString(),
    };

    const exists = favorites.some((favorite) => favorite.id === nextFavorite.id);
    if (exists) {
      toast.info("Already saved locally");
      return;
    }

    localStorage.setItem("routeMaxFavorites", JSON.stringify([nextFavorite, ...favorites]));
    toast.success("Saved to this device");
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const goToNextStep = () => {
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1));
  };

  const replayCurrentInstruction = () => {
    const step = steps[currentStep];
    if (!step) return;

    const instruction = step.distance
      ? `In ${step.distance}, ${step.instruction}`
      : step.instruction;
    speak(instruction);
  };

  const vehicleEmoji = vehicle === "bus" ? "🚌" : vehicle === "bike" ? "🏍️" : vehicle === "walk" ? "🚶" : "🚗";

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
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={replayCurrentInstruction}
              className="touch-target rounded-full bg-primary-foreground/10"
              title="Replay instruction"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setMuted(!muted)} className="touch-target rounded-full bg-primary-foreground/10">
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={goToPreviousStep}
            disabled={currentStep === 0}
            className="flex items-center justify-center gap-1 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={goToNextStep}
            disabled={currentStep >= steps.length - 1}
            className="flex items-center justify-center gap-1 rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Transit details for bus */}
        {steps[currentStep]?.transitDetails && (
          <div className="bg-primary-foreground/10 rounded-lg px-3 py-2 text-xs mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold">🚌 {steps[currentStep].transitDetails?.lineName}</span>
              {steps[currentStep].transitDetails?.departureStop && (
                <span>from {steps[currentStep].transitDetails?.departureStop}</span>
              )}
            </div>
            {steps[currentStep].transitDetails?.numStops && (
              <span className="text-primary-foreground/60">{steps[currentStep].transitDetails?.numStops} stops</span>
            )}
          </div>
        )}

        {currentStep + 1 < steps.length && (
          <div className="bg-primary-foreground/10 rounded-lg px-3 py-2 text-xs truncate">
            Then: {steps[currentStep + 1]?.instruction}
          </div>
        )}

        {/* GPS + Weather Status */}
        <div className="flex items-center gap-2 mt-2 text-xs text-primary-foreground/60">
          <Locate className={`w-3 h-3 ${gpsActive ? "text-green-300" : "text-primary-foreground/40"}`} />
          <span>
            {gpsActive
              ? `GPS active · ${gpsAccuracy ? `±${Math.round(gpsAccuracy)}m` : "Tracking"}`
              : "Waiting for GPS..."}
          </span>
          {weather && (
            <span className="ml-1">{weather.emoji} {weather.temperature}°C</span>
          )}
          <span className="ml-auto">{vehicleEmoji} {vehicle.charAt(0).toUpperCase() + vehicle.slice(1)}</span>
        </div>
      </div>

      {/* Steps List Toggle */}
      <button
        onClick={() => setShowSteps(!showSteps)}
        className="absolute bottom-[120px] right-4 z-[500] bg-card shadow-lg rounded-full w-10 h-10 flex items-center justify-center"
      >
        {showSteps ? <ChevronDown className="w-5 h-5 text-foreground" /> : <ChevronUp className="w-5 h-5 text-foreground" />}
      </button>

      {/* Steps Panel */}
      {showSteps && (
        <div className="absolute bottom-[170px] left-4 right-4 z-[500] bg-card rounded-xl shadow-lg max-h-[40vh] overflow-y-auto p-3">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">ALL STEPS</h3>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs p-2 rounded-lg ${
                  i === currentStep ? "bg-primary/10 text-primary font-medium" : i < currentStep ? "text-muted-foreground line-through opacity-50" : "text-foreground"
                }`}
              >
                <span className="text-base shrink-0">{step.icon}</span>
                <div className="min-w-0">
                  <p className="truncate">{step.instruction}</p>
                  <p className="text-[10px] text-muted-foreground">{step.distance} · {step.duration}</p>
                  {step.transitDetails && (
                    <p className="text-[10px] text-primary">
                      🚌 {step.transitDetails.lineName} · {step.transitDetails.numStops} stops
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Info */}
      <div className="absolute bottom-0 left-0 right-0 z-[500] bg-card p-4 safe-bottom">
        {/* Weather warning */}
        {weather?.drivingWarning && (
          <div className="bg-destructive/10 text-destructive text-[10px] px-3 py-1.5 rounded-lg mb-2 flex items-center gap-1">
            <span>⚠️</span>
            <span>{weather.drivingWarning}</span>
          </div>
        )}
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
              onClick={goToPreviousStep}
              disabled={currentStep === 0}
              className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={goToNextStep}
              disabled={currentStep >= steps.length - 1}
              className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={saveToFavorites}
              className="btn-ghost px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1"
            >
              <Star className="w-4 h-4" /> Save
            </button>
            <button
              onClick={() => {
                if (watchIdRef.current !== null) {
                  navigator.geolocation.clearWatch(watchIdRef.current);
                }
                window.speechSynthesis.cancel();
                navigate("/");
              }}
              className="btn-danger px-4 py-2 rounded-lg text-xs font-semibold"
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
