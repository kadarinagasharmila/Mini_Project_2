import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Clock, MapPin, Navigation, Share2, IndianRupee, Sparkles, Loader2, Brain, Bus, Bike, Footprints, Heart, ExternalLink, ListChecks } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import MapView from "@/components/MapView";
import SavedRoutesPanel from "@/components/SavedRoutesPanel";
import RoadHazards from "@/components/RoadHazards";
import RouteMlInsights from "@/components/RouteMlInsights";

import {
  buildDepartureOptions,
  formatIndiaDateTime,
  generateTrafficAiInsight,
  getForecastPointForTime,
  getForecastSeverity,
  getForecastSeverityLabel,
  getHourlyForecast,
  getRoute,
  getWeather,
  getHazardsNearRoute,
  predictRouteMLRisk,
  getSavedRoutes,
  saveRoute,
  HourlyForecastPoint,
  parseIndiaDateTimeInput,
  RouteResult,
  WeatherData,
  SavedRoute,
} from "@/services/routingService";
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
    departureTime?: string | null;
  } | null;

  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [analysisTime, setAnalysisTime] = useState<Date | null>(null);
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastPoint[]>([]);
  const [loadError, setLoadError] = useState("");
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);

  const source = useMemo<[number, number]>(
    () => state?.source || [17.385, 78.4867],
    [state?.source]
  );
  const destination = useMemo<[number, number]>(
    () => state?.destination || [17.3616, 78.4747],
    [state?.destination]
  );
  const destName = state?.destName || "Destination";
  const vehicle = state?.vehicle || "car";
  const plannedDepartureTime = useMemo(
    () => parseIndiaDateTimeInput(state?.departureTime),
    [state?.departureTime]
  );
  const baseAnalysisTime = useMemo(
    () =>
      plannedDepartureTime && !Number.isNaN(plannedDepartureTime.getTime())
        ? plannedDepartureTime
        : new Date(),
    [plannedDepartureTime]
  );
  const isCustomFutureDeparture = Boolean(
    plannedDepartureTime && plannedDepartureTime.getTime() - Date.now() > 6 * 60 * 60 * 1000
  );

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setLoadError("");
      const snapshotTime = baseAnalysisTime;
      setAnalysisTime(snapshotTime);
      try {

        // Allow weather/forecast failures without blocking the route results.
        const [routeResult, weatherResult, forecastResult] = await Promise.allSettled([
          getRoute(source as [number, number], destination as [number, number], vehicle, state?.avoidTolls || false),
          getWeather(destination[0], destination[1]),
          getHourlyForecast(destination[0], destination[1]),
        ]);

        if (routeResult.status !== "fulfilled") {
          throw routeResult.reason instanceof Error ? routeResult.reason : new Error("Could not load routes.");
        }

        const results = routeResult.value;
        const liveWeatherData = weatherResult.status === "fulfilled" ? weatherResult.value : null;
        const forecastData = forecastResult.status === "fulfilled" ? forecastResult.value : [];
        const weatherData = isCustomFutureDeparture ? null : liveWeatherData;

        setRoutes(results);
        setWeather(weatherData);
        setHourlyForecast(forecastData);

        // Load saved routes
        setSavedRoutes(getSavedRoutes());

        setAiLoading(true);
        try {
          setAiInsight(
            await generateTrafficAiInsight({
              sourceName: state?.sourceName || "Your location",
              destName,
              vehicle,
              distanceKm: results[0]?.distance,
              durationMin: results[0]?.duration,
              weather: weatherData,
              analysisTime: snapshotTime,
            })
          );
        } catch {
          setAiInsight("");
        }
        setAiLoading(false);
      } catch (error) {
        console.error("Failed to load results:", error);
        setRoutes([]);
        setWeather(null);
        setHourlyForecast([]);
        setAiInsight("");
        setLoadError("Could not load routes right now. Please try again in a moment.");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [baseAnalysisTime, destination, source, state?.avoidTolls, state?.sourceName, vehicle, destName, isCustomFutureDeparture]);

  const routeNames = routes.map((r, i) => r.summary || (i === 0 ? "Recommended" : `Route ${i + 1}`));

  const currentRoute = routes[selectedRoute];
  const alternateRouteGeometries = routes
    .filter((_, index) => index !== selectedRoute)
    .map((route) => route.geometry)
    .filter((geometry) => geometry.length > 0);
  const hazards = useMemo(
    () => (currentRoute?.geometry?.length ? getHazardsNearRoute(currentRoute.geometry) : []),
    [currentRoute]
  );
  const mlPrediction = useMemo(
    () =>
      currentRoute
        ? predictRouteMLRisk({
            route: currentRoute,
            vehicle,
            hazards,
            weather,
            analysisTime: baseAnalysisTime,
          })
        : null,
    [baseAnalysisTime, currentRoute, hazards, vehicle, weather]
  );
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
    const eta = new Date(baseAnalysisTime.getTime() + min * 60000);
    return eta.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const formattedAnalysisDate = analysisTime
    ? formatIndiaDateTime(analysisTime, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: undefined,
        minute: undefined,
      })
    : "";

  const formattedAnalysisTime = analysisTime
    ? formatIndiaDateTime(analysisTime, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  const departureOptions = buildDepartureOptions(routes[0]?.duration, vehicle, hourlyForecast, baseAnalysisTime);
  const departureForecast = getForecastPointForTime(hourlyForecast, baseAnalysisTime);
  const arrivalForecast = routes[0]?.duration
    ? getForecastPointForTime(
        hourlyForecast,
        new Date(baseAnalysisTime.getTime() + routes[0].duration * 60000)
      )
    : undefined;
  const departureSeverity = getForecastSeverity(departureForecast);
  const arrivalSeverity = getForecastSeverity(arrivalForecast);
  const weatherWorsens =
    departureForecast &&
    arrivalForecast &&
    severityRank(arrivalSeverity) > severityRank(departureSeverity);

  const VehicleIcon = vehicle === "bus" ? Bus : vehicle === "bike" ? Bike : vehicle === "walk" ? Footprints : Navigation;
  const mapsTravelMode = vehicle === "walk" ? "walking" : vehicle === "bus" ? "transit" : "driving";
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${source[0]},${source[1]}&destination=${destination[0]},${destination[1]}&travelmode=${mapsTravelMode}`;
  const selectedSteps = currentRoute?.steps ?? [];
  const firstManeuver = selectedSteps[0];
  const nextManeuver = selectedSteps.find((step) => step.instruction !== firstManeuver?.instruction);

  const handleShareSelectedRoute = async () => {
    if (!currentRoute) return;

    const message = `${state?.sourceName || "My Location"} to ${destName}: ${formatDuration(currentRoute.duration)}, ${currentRoute.distance} km, ${currentRoute.trafficLevel}. ${googleMapsUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Route to ${destName}`,
          text: message,
          url: googleMapsUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(message);
      toast.success("Route details copied");
    } catch {
      toast.error("Could not share this route");
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Map Section */}
      <div className="relative h-[40%]">
        <MapView
          userLocation={source as [number, number]}
          destination={destination as [number, number]}
          routeCoords={currentRoute?.geometry}
          alternateRouteCoords={alternateRouteGeometries}
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
              {/* Saved Routes Toggle */}
              <button
                onClick={() => setShowSavedRoutes(!showSavedRoutes)}
                className="w-full mb-3 flex items-center justify-center gap-2 bg-primary/10 text-primary px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/15 transition-colors"
              >
                <Heart className="w-4 h-4" />
                {showSavedRoutes ? "Hide" : "Saved Routes"} ({savedRoutes.length})
              </button>

              {showSavedRoutes && (
                <div className="mb-3 bg-card border border-border rounded-xl p-3">
                  <SavedRoutesPanel
                    savedRoutes={savedRoutes}
                    onSelect={(route) => {
                      navigate("/results", {
                        state: {
                          source: route.source,
                          destination: route.destination,
                          vehicle: route.vehicle,
                          destName: route.destLabel,
                          sourceName: route.sourceLabel,
                          avoidTolls: false,
                          departureTime: null,
                        },
                      });
                    }}
                    onDelete={() => setSavedRoutes(getSavedRoutes())}
                  />
                </div>
              )}

              {loadError && (
                <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                  {loadError}
                </div>
              )}

              {/* Road Hazards */}
              {hazards.length > 0 && <RoadHazards hazards={hazards} />}

              {mlPrediction && <RouteMlInsights prediction={mlPrediction} />}

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
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span>🌧 {weather.precipitation} mm</span>
                      {weather.visibility !== null && <span>👁 {weather.visibility} km</span>}
                    </div>
                  </div>
                  {weather.drivingWarning && (
                    <div className="bg-destructive/10 text-destructive text-[10px] px-2 py-1 rounded-lg max-w-[120px]">
                      {weather.drivingWarning.split(".")[0]}
                    </div>
                  )}
                </div>
              )}

              {analysisTime && (
                <div className="bg-card border border-border rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Analysis Context</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      {plannedDepartureTime ? "Departure" : "Time"}: {formattedAnalysisTime} IST
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1">
                      Date: {formattedAnalysisDate}
                    </span>
                    {weather && (
                      <span className="rounded-full bg-muted px-2.5 py-1">
                        Weather: {weather.condition}, {weather.temperature}°C
                      </span>
                    )}
                  </div>
                </div>
              )}

              {isCustomFutureDeparture && (
                <div className="bg-card border border-border rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Future Date Mode</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    Live weather and short-term forecast are skipped for this selected date. Traffic risk is based on
                    historical time patterns, festival/event context, road hazards, and route behavior.
                  </p>
                </div>
              )}

              {!isCustomFutureDeparture && (departureForecast || arrivalForecast) && (
                <div className="bg-card border border-border rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Departure vs Arrival Weather</span>
                  </div>
                  {weatherWorsens && (
                    <div className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
                      Arrival weather looks worse than departure. Consider leaving earlier or keeping extra travel buffer.
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {departureForecast && (
                      <div className={`rounded-lg px-3 py-3 ${severityCardClass(departureSeverity)}`}>
                        <p className="text-xs font-semibold text-foreground">Departure</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatIndiaDateTime(baseAnalysisTime, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {departureForecast.emoji} {departureForecast.condition}
                        </p>
                        <p className={`mt-1 text-[11px] font-medium ${severityTextClass(departureSeverity)}`}>
                          {getForecastSeverityLabel(departureForecast)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{departureForecast.temperature}°C</span>
                          <span>🌧 {departureForecast.precipitation} mm</span>
                          <span>💨 {departureForecast.windSpeed} km/h</span>
                        </div>
                      </div>
                    )}
                    {arrivalForecast && (
                      <div className={`rounded-lg px-3 py-3 ${severityCardClass(arrivalSeverity)}`}>
                        <p className="text-xs font-semibold text-foreground">Arrival</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {routes[0]?.duration
                            ? formatIndiaDateTime(new Date(baseAnalysisTime.getTime() + routes[0].duration * 60000), {
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : ""}
                        </p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {arrivalForecast.emoji} {arrivalForecast.condition}
                        </p>
                        <p className={`mt-1 text-[11px] font-medium ${severityTextClass(arrivalSeverity)}`}>
                          {getForecastSeverityLabel(arrivalForecast)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span>{arrivalForecast.temperature}°C</span>
                          <span>🌧 {arrivalForecast.precipitation} mm</span>
                          <span>💨 {arrivalForecast.windSpeed} km/h</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <h2 className="text-base font-semibold text-foreground mb-3">
                {routes.length} route{routes.length !== 1 ? "s" : ""} found
              </h2>

              {!loadError && routes.length === 0 && (
                <div className="rounded-xl border border-border bg-card px-3 py-4 text-sm text-muted-foreground">
                  No routes were returned for this trip.
                </div>
              )}

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

              {departureOptions.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>Best Departure</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    {departureOptions.map((option) => (
                      <div
                        key={option.id}
                        className={`rounded-lg border px-3 py-2 ${option.recommended ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {option.offsetMin === 0
                                ? plannedDepartureTime
                                  ? "Selected departure"
                                  : "Leave now"
                                : `Leave ${option.offsetMin} min later`}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {option.departureTime.toLocaleTimeString("en-IN", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                                timeZone: "Asia/Kolkata",
                              })}
                              {option.arrivalTime && (
                                <> · arrive about {option.arrivalTime.toLocaleTimeString("en-IN", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                  hour12: true,
                                  timeZone: "Asia/Kolkata",
                                })}</>
                              )}
                            </p>
                          </div>
                          {option.recommended && (
                            <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                              Best
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-background px-2 py-1">{option.label}</span>
                          {option.forecast && (
                            <>
                              <span className="rounded-full bg-background px-2 py-1">
                                {option.forecast.emoji} {option.forecast.temperature}°C
                              </span>
                              <span className="rounded-full bg-background px-2 py-1">
                                🌧 {option.forecast.precipitation} mm
                              </span>
                              <span className="rounded-full bg-background px-2 py-1">
                                💨 {option.forecast.windSpeed} km/h
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {hourlyForecast.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-3 mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <span>Next Hours</span>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {hourlyForecast.map((point) => (
                      <div
                        key={point.time}
                        className="min-w-[96px] rounded-lg bg-muted/40 px-3 py-2 text-center"
                      >
                        <p className="text-[11px] font-medium text-foreground">
                          {new Date(point.time).toLocaleTimeString("en-IN", {
                            hour: "numeric",
                            hour12: true,
                            timeZone: "Asia/Kolkata",
                          })}
                        </p>
                        <p className="mt-1 text-xl">{point.emoji}</p>
                        <p className="text-sm font-semibold text-foreground">{point.temperature}°C</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">🌧 {point.precipitation} mm</p>
                        <p className="text-[10px] text-muted-foreground">💨 {point.windSpeed} km/h</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentRoute && (
                <div className="bg-card border border-border rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <ListChecks className="w-3.5 h-3.5 text-primary" />
                      <span>Selected Route</span>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">
                      {routeNames[selectedRoute] || `Route ${selectedRoute + 1}`}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 px-2 py-2">
                      <p className="text-sm font-bold text-foreground">{formatDuration(currentRoute.duration)}</p>
                      <p className="text-[10px] text-muted-foreground">Duration</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2 py-2">
                      <p className="text-sm font-bold text-foreground">{currentRoute.distance} km</p>
                      <p className="text-[10px] text-muted-foreground">Distance</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-2 py-2">
                      <p className="text-sm font-bold text-foreground">{selectedSteps.length}</p>
                      <p className="text-[10px] text-muted-foreground">Steps</p>
                    </div>
                  </div>
                  {(firstManeuver || nextManeuver) && (
                    <div className="mt-3 space-y-2">
                      {firstManeuver && (
                        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                          <span className="text-base leading-none">{firstManeuver.icon}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{firstManeuver.instruction}</p>
                            <p className="text-[10px] text-muted-foreground">{firstManeuver.distance} · {firstManeuver.duration}</p>
                          </div>
                        </div>
                      )}
                      {nextManeuver && (
                        <div className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                          <span className="text-base leading-none">{nextManeuver.icon}</span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">Then {nextManeuver.instruction}</p>
                            <p className="text-[10px] text-muted-foreground">{nextManeuver.distance} · {nextManeuver.duration}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleShareSelectedRoute}
                      className="flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Share
                    </button>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/80"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open Maps
                    </a>
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
                    } route-card`}
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
                      <div className="flex gap-3 mt-3 items-center">
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
                          className="btn-primary flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <Navigation className="w-4 h-4" />
                          Start Navigation
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareSelectedRoute();
                          }}
                          className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                          title="Share"
                        >
                          <Share2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newSavedRoute = saveRoute({
                              name: `${state?.sourceName || "My Location"} → ${destName}`,
                              source,
                              sourceLabel: state?.sourceName || "My Location",
                              destination,
                              destLabel: destName,
                              vehicle,
                            });
                            setSavedRoutes(getSavedRoutes());
                            toast.success("Route saved!");
                          }}
                          className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center hover:bg-warning/10 transition-colors"
                          title="Save route"
                        >
                          <Heart className="w-4 h-4 text-muted-foreground" />
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

function severityRank(value: "low" | "medium" | "high") {
  if (value === "high") return 3;
  if (value === "medium") return 2;
  return 1;
}

function severityCardClass(value: "low" | "medium" | "high") {
  if (value === "high") return "bg-destructive/10 border border-destructive/20";
  if (value === "medium") return "bg-warning/10 border border-warning/20";
  return "bg-secondary/10 border border-secondary/20";
}

function severityTextClass(value: "low" | "medium" | "high") {
  if (value === "high") return "text-destructive";
  if (value === "medium") return "text-warning";
  return "text-secondary";
}
