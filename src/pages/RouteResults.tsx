import { useState, useEffect } from "react";
import { ArrowLeft, Clock, MapPin, Navigation, Share2, Star, IndianRupee, Sparkles, Loader2, Brain, Cloud, Thermometer, Bus, Bike, Footprints } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import MapView from "@/components/MapView";

import { getRoute, getWeather, RouteResult, WeatherData } from "@/services/routingService";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";

const RouteResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    source: [number, number];
    destination: [number, number];
    vehicle: string;
    destName: string;
    sourceName?: string;
    avoidTolls: boolean;
  } | null;

  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const source = state?.source || [17.385, 78.4867];
  const destination = state?.destination || [17.3616, 78.4747];
  const destName = state?.destName || "Destination";
  const vehicle = state?.vehicle || "car";

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // Fetch routes and weather in parallel
      const [results, weatherData] = await Promise.all([
        getRoute(source as [number, number], destination as [number, number], vehicle, state?.avoidTolls || false),
        getWeather(destination[0], destination[1]),
      ]);

      setRoutes(results);
      setWeather(weatherData);
      setLoading(false);

      // Fetch AI analysis
      setAiLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("traffic-ai", {
          body: {
            routeInfo: {
              sourceName: state?.sourceName || "Your location",
              destName,
              distance: results[0]?.distance,
              vehicle,
              weather: weatherData ? `${weatherData.condition}, ${weatherData.temperature}°C` : undefined,
            },
          },
        });
        if (!error && data?.analysis) {
          setAiInsight(data.analysis);
        }
      } catch {}
      setAiLoading(false);
    };
    fetchAll();
  }, []);

  const routeNames = routes.map((r, i) => r.summary || (i === 0 ? "Recommended" : `Route ${i + 1}`));

  const currentRoute = routes[selectedRoute];
  const bounds = currentRoute?.geometry?.length
    ? L.latLngBounds(currentRoute.geometry.map((c) => L.latLng(c[0], c[1])))
    : undefined;

  const formatDuration = (min: number) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const getETA = (min: number) => {
    const eta = new Date(Date.now() + min * 60000);
    return eta.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const VehicleIcon = vehicle === "bus" ? Bus : vehicle === "bike" ? Bike : vehicle === "walk" ? Footprints : Navigation;

  return (
    <div className="h-screen flex flex-col">
      {/* Map Section */}
      <div className="relative h-[40%]">
        <MapView
          userLocation={source as [number, number]}
          destination={destination as [number, number]}
          routeCoords={currentRoute?.geometry}
          bounds={bounds}
        />
        <button
          onClick={() => navigate("/plan")}
          className="absolute top-4 left-4 z-[500] map-control-btn w-10 h-10"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="absolute top-4 left-16 right-4 z-[500] floating-card px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-secondary" />
            <span className="truncate">{state?.sourceName || "Your location"}</span>
            <span className="text-muted-foreground/50">→</span>
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span className="truncate">{destName}</span>
          </div>
        </div>
      </div>

      {/* Routes Bottom Sheet */}
      <div className="flex-1 bottom-sheet -mt-4 overflow-y-auto pb-20">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4" />
        <div className="px-4 pb-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Finding best routes...</p>
            </div>
          ) : (
            <>
              {/* Weather Card */}
              {weather && (
                <div className="bg-muted/50 rounded-xl p-3 mb-3 flex items-center gap-3">
                  <span className="text-2xl">{weather.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{weather.temperature}°C</span>
                      <span className="text-xs text-muted-foreground">{weather.condition}</span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span>Feels {weather.feelsLike}°C</span>
                      <span>💧 {weather.humidity}%</span>
                      <span>💨 {weather.windSpeed} km/h</span>
                    </div>
                  </div>
                  {weather.drivingWarning && (
                    <div className="bg-destructive/10 text-destructive text-[10px] px-2 py-1 rounded-lg max-w-[120px]">
                      {weather.drivingWarning.split(".")[0]}
                    </div>
                  )}
                </div>
              )}

              <h2 className="text-base font-semibold text-foreground mb-3">
                {routes.length} route{routes.length !== 1 ? "s" : ""} found
              </h2>

              {/* AI Traffic Insight */}
              {(aiInsight || aiLoading) && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-3 flex items-start gap-2">
                  <Brain className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-primary mb-1">AI Traffic Analysis</p>
                    {aiLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 text-primary animate-spin" />
                        <span className="text-xs text-muted-foreground">Analyzing traffic patterns...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{aiInsight.replace(/\*\*/g, "")}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {routes.map((route, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedRoute(idx)}
                    className={`w-full text-left floating-card p-4 transition-all active:scale-[0.98] ${
                      idx === selectedRoute ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    {idx === 0 && (
                      <span className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2">
                        <Sparkles className="w-3 h-3" /> AI Recommended
                      </span>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          {routeNames[idx] || `Route ${idx + 1}`}
                        </h3>
                        <p className={`text-xs font-medium mt-0.5 ${route.trafficColor}`}>
                          {route.trafficLevel}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-foreground">
                          {formatDuration(route.duration)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ETA {getETA(route.duration)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {route.distance} km
                      </span>
                      <span className="flex items-center gap-1">
                        <IndianRupee className="w-3 h-3" />
                        {route.toll}
                      </span>
                      <span className="flex items-center gap-1">
                        <VehicleIcon className="w-3 h-3" />
                        {vehicle.charAt(0).toUpperCase() + vehicle.slice(1)}
                      </span>
                    </div>

                    {/* Vehicle-specific info */}
                    {route.vehicleInfo?.transitSummary && (
                      <div className="mt-2 bg-muted/50 rounded-lg px-2 py-1.5 text-[10px] text-muted-foreground flex items-center gap-1">
                        <Bus className="w-3 h-3 shrink-0" />
                        <span className="truncate">{route.vehicleInfo.transitSummary}</span>
                      </div>
                    )}
                    {route.vehicleInfo?.calories && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        🔥 ~{route.vehicleInfo.calories} calories burned
                      </div>
                    )}
                    {route.vehicleInfo?.bikeNote && (
                      <div className="mt-2 text-[10px] text-muted-foreground">
                        🏍️ {route.vehicleInfo.bikeNote}
                      </div>
                    )}

                    {idx === selectedRoute && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/navigate", {
                              state: {
                                route,
                                destName,
                                sourceName: state?.sourceName || "Current Location",
                                sourceCoords: source,
                                destCoords: destination,
                                vehicle,
                                weather,
                              },
                            });
                          }}
                          className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Start Navigation
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-10 h-9 rounded-lg bg-muted flex items-center justify-center"
                        >
                          <Share2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-10 h-9 rounded-lg bg-muted flex items-center justify-center"
                        >
                          <Star className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RouteResults;
