import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpDown, Car, Bike, Bus, Footprints, History, MapPin, Clock, Search, Sparkles, Loader2, LocateFixed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  formatIndiaDateTime,
  formatIndiaDateTimeInput,
  geocodeLocation,
  getIndiaNow,
  getIndiaPresetDateTime,
  getInstantTelanganaPlaces,
  getOptimalDeparture,
  isPastIndiaDateTimeInput,
  getPlaceAutocomplete,
  getPlaceDetails,
  getUserLocation,
  parseIndiaDateTimeInput,
  PlacePrediction,
} from "@/services/routingService";
import { toast } from "sonner";

const vehicleTypes = [
  { id: "car", icon: Car, label: "Car" },
  { id: "bike", icon: Bike, label: "Bike" },
  { id: "bus", icon: Bus, label: "Bus" },
  { id: "walk", icon: Footprints, label: "Walk" },
];

const departurePresets = [
  { id: "now", label: "Now" },
  { id: "plus30", label: "+30 min" },
  { id: "tonight20", label: "Tonight 8 PM" },
  { id: "tomorrow08", label: "Tomorrow 8 AM" },
] as const;

const RECENT_TRIPS_KEY = "routeMaxRecentTrips";
const MAX_RECENT_TRIPS = 50;

interface RecentTrip {
  id: string;
  sourceName: string;
  destinationName: string;
  sourceCoords?: [number, number];
  destinationCoords?: [number, number];
  vehicle: string;
  departureTime?: string;
  createdAt: string;
}

const RoutePlanning = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialDestination = searchParams.get("destination")?.trim() ?? "";
  const [vehicle, setVehicle] = useState("car");
  const [source, setSource] = useState("My Location");
  const [destination, setDestination] = useState(initialDestination);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [sourceSuggestions, setSourceSuggestions] = useState<PlacePrediction[]>([]);
  const [selectedSourcePlaceId, setSelectedSourcePlaceId] = useState<string | null>(null);
  const [selectedDestPlaceId, setSelectedDestPlaceId] = useState<string | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [departureTime, setDepartureTime] = useState("");
  const [departureTimeError, setDepartureTimeError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const sourceDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const destSearchIdRef = useRef(0);
  const sourceSearchIdRef = useRef(0);

  const aiSuggestion = getOptimalDeparture(20);
  const minimumDepartureTime = formatIndiaDateTimeInput(getIndiaNow());
  const presetStates = departurePresets.map((preset) => {
    const value = getIndiaPresetDateTime(preset.id);
    return {
      ...preset,
      value,
      disabled: isPastIndiaDateTimeInput(value),
    };
  });

  useEffect(() => {
    const storedTrips = localStorage.getItem(RECENT_TRIPS_KEY);
    if (!storedTrips) return;

    try {
      const parsed = JSON.parse(storedTrips) as RecentTrip[];
      setRecentTrips(Array.isArray(parsed) ? parsed : []);
    } catch {
      setRecentTrips([]);
    }
  }, []);

  const persistRecentTrips = (updater: (current: RecentTrip[]) => RecentTrip[]) => {
    setRecentTrips((current) => {
      const next = updater(current).slice(0, MAX_RECENT_TRIPS);
      localStorage.setItem(RECENT_TRIPS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const saveRecentTrip = (trip: Omit<RecentTrip, "id" | "createdAt">) => {
    persistRecentTrips((current) => {
      const id = `${trip.sourceName}|${trip.destinationName}|${trip.vehicle}`;
      const deduped = current.filter((item) => item.id !== id);

      return [
        {
          ...trip,
          id,
          createdAt: new Date().toISOString(),
        },
        ...deduped,
      ];
    });
  };

  const applyRecentTrip = (trip: RecentTrip) => {
    setSource(trip.sourceName);
    setDestination(trip.destinationName);
    setVehicle(trip.vehicle);
    setSelectedSourcePlaceId(
      trip.sourceCoords ? `${trip.sourceCoords[0]},${trip.sourceCoords[1]}` : null
    );
    setSelectedDestPlaceId(
      trip.destinationCoords ? `${trip.destinationCoords[0]},${trip.destinationCoords[1]}` : null
    );
    setDepartureTime(trip.departureTime || "");
    setDepartureTimeError("");
    setSourceSuggestions([]);
    setSuggestions([]);
    setError("");
  };

  const validateDepartureTime = (value: string) => {
    if (!value) {
      setDepartureTimeError("");
      return true;
    }

    const parsed = parseIndiaDateTimeInput(value);
    if (!parsed || Number.isNaN(parsed.getTime())) {
      setDepartureTimeError("Enter a valid departure time.");
      return false;
    }

    if (parsed.getTime() < getIndiaNow().getTime()) {
      setDepartureTimeError("Departure time cannot be in the past for India time.");
      return false;
    }

    setDepartureTimeError("");
    return true;
  };

  const applyDeparturePreset = (preset: (typeof departurePresets)[number]["id"]) => {
    const nextValue = getIndiaPresetDateTime(preset);
    setDepartureTime(nextValue);
    validateDepartureTime(nextValue);
  };

  const handleSwapLocations = () => {
    if (source === "My Location") {
      toast.info("Pick a fixed source before swapping with destination.");
      return;
    }

    const previousSource = source;
    const previousSourcePlaceId = selectedSourcePlaceId;

    setSource(destination || "My Location");
    setDestination(previousSource);
    setSelectedSourcePlaceId(selectedDestPlaceId);
    setSelectedDestPlaceId(previousSourcePlaceId);
    setSourceSuggestions([]);
    setSuggestions([]);
    setError("");
  };

  const handleSearch = async () => {
    if (!destination) return;
    setError("");
    if (!validateDepartureTime(departureTime)) return;
    setLoading(true);

    try {
      // Resolve destination coords
      let destCoords: [number, number] | null = null;
      if (selectedDestPlaceId) {
        const details = await getPlaceDetails(selectedDestPlaceId);
        if (details) destCoords = [details.lat, details.lng];
      }
      if (!destCoords) {
        destCoords = await geocodeLocation(destination);
      }
      if (!destCoords) {
        setError(`Location "${destination}" not found. Try a different search term.`);
        setLoading(false);
        return;
      }

      // Resolve source coords
      let srcCoords: [number, number] | null = null;
      if (source === "My Location") {
        try {
          srcCoords = await getUserLocation();
        } catch {
          toast.error("Could not get your location. Using Hyderabad center.");
          srcCoords = [17.385, 78.4867];
        }
      } else if (selectedSourcePlaceId) {
        const details = await getPlaceDetails(selectedSourcePlaceId);
        if (details) srcCoords = [details.lat, details.lng];
      }
      if (!srcCoords) {
        srcCoords = await geocodeLocation(source);
      }
      if (!srcCoords) {
        setError(`Source location "${source}" not found.`);
        setLoading(false);
        return;
      }

      saveRecentTrip({
        sourceName: source,
        destinationName: destination,
        sourceCoords: srcCoords,
        destinationCoords: destCoords,
        vehicle,
        departureTime: departureTime || undefined,
      });

      navigate("/results", {
        state: {
          source: srcCoords,
          destination: destCoords,
          vehicle,
          destName: destination,
          sourceName: source,
          avoidTolls,
          departureTime: departureTime || null,
        },
      });
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUseMyLocation = async () => {
    setLocatingGps(true);
    try {
      await getUserLocation();
      setSource("My Location");
      setSelectedSourcePlaceId(null);
      setSourceSuggestions([]);
      toast.success("Using your current location");
    } catch {
      toast.error("Could not access GPS. Please enable location services.");
    } finally {
      setLocatingGps(false);
    }
  };

  // Autocomplete for destination
  const handleDestChange = (val: string) => {
    setDestination(val);
    setSelectedDestPlaceId(null);
    setError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const requestId = destSearchIdRef.current + 1;
    destSearchIdRef.current = requestId;

    if (val.trim().length >= 1) {
      setSuggestions(getInstantTelanganaPlaces(val, 10));
    }

    if (val.trim().length >= 2) {
      debounceRef.current = setTimeout(async () => {
        const preds = await getPlaceAutocomplete(val);
        if (destSearchIdRef.current === requestId) {
          setSuggestions(preds);
        }
      }, 120);
    } else if (val.trim().length === 0) {
      setSuggestions([]);
    }
  };

  const selectDestinationSuggestion = (suggestion: PlacePrediction) => {
    setDestination(suggestion.description);
    setSelectedDestPlaceId(suggestion.placeId);
    setSuggestions([]);
    setError("");
  };

  const selectSourceSuggestion = (suggestion: PlacePrediction) => {
    setSource(suggestion.description);
    setSelectedSourcePlaceId(suggestion.placeId);
    setSourceSuggestions([]);
  };

  // Autocomplete for source
  const handleSourceChange = (val: string) => {
    setSource(val);
    setSelectedSourcePlaceId(null);
    if (sourceDebounceRef.current) clearTimeout(sourceDebounceRef.current);
    const requestId = sourceSearchIdRef.current + 1;
    sourceSearchIdRef.current = requestId;

    if (val.trim().length >= 1 && val !== "My Location") {
      setSourceSuggestions(getInstantTelanganaPlaces(val, 10));
    }

    if (val.trim().length >= 2 && val !== "My Location") {
      sourceDebounceRef.current = setTimeout(async () => {
        const preds = await getPlaceAutocomplete(val);
        if (sourceSearchIdRef.current === requestId) {
          setSourceSuggestions(preds);
        }
      }, 120);
    } else if (val.trim().length === 0 || val === "My Location") {
      setSourceSuggestions([]);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <div className="bg-primary px-4 pt-4 pb-6">
        <button onClick={() => navigate("/")} className="touch-target -ml-2 mb-2">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="flex items-center gap-3 bg-primary-foreground/15 rounded-lg px-3 py-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <input
                  value={source}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  onBlur={() => setTimeout(() => setSourceSuggestions([]), 150)}
                  placeholder="Your location"
                  autoComplete="off"
                  className="flex-1 bg-transparent text-primary-foreground placeholder:text-primary-foreground/60 text-sm outline-none"
                />
              </div>
              {sourceSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-[700] mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                  {sourceSuggestions.map((s) => (
                    <button
                      key={`${s.placeId}-${s.description}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSourceSuggestion(s);
                      }}
                      onTouchStart={() => selectSourceSuggestion(s)}
                      className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{s.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleUseMyLocation}
              disabled={locatingGps}
              className="shrink-0 bg-primary-foreground/15 rounded-lg p-2.5 text-primary-foreground hover:bg-primary-foreground/25 transition-colors"
              title="Use my location"
            >
              {locatingGps ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LocateFixed className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwapLocations}
              className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-foreground/25"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              Swap source and destination
            </button>
          </div>
          <div className="relative mt-2">
            <div className="flex items-center gap-3 bg-primary-foreground/15 rounded-lg px-3 py-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
              <input
                value={destination}
                onChange={(e) => handleDestChange(e.target.value)}
                onBlur={() => setTimeout(() => setSuggestions([]), 150)}
                placeholder="Where to? (e.g. Charminar, Hitech City)"
                autoComplete="off"
                className="flex-1 bg-transparent text-primary-foreground placeholder:text-primary-foreground/60 text-sm outline-none"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-[700] mt-1 max-h-72 overflow-y-auto rounded-lg border border-border bg-card shadow-xl">
                {suggestions.map((s) => (
                  <button
                    key={`${s.placeId}-${s.description}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectDestinationSuggestion(s);
                    }}
                    onTouchStart={() => selectDestinationSuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{s.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {destination.trim() && (
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="mt-3 w-full rounded-lg bg-primary-foreground px-3 py-2.5 text-sm font-semibold text-primary transition-transform active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Finding Routes..." : "Find Routes"}
            </button>
          )}
        </div>
      </div>

      {/* Vehicle Selector */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex gap-2">
          {vehicleTypes.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setVehicle(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
                vehicle === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preferences */}
      <div className="px-4 py-3 border-b border-border flex gap-2 overflow-x-auto">
        <Chip
          label={departureTime ? `Depart ${formatIndiaDateTime(departureTime)}` : "Depart Now"}
          icon={Clock}
          active
        />
        <Chip label={avoidTolls ? "Avoid Tolls Limited" : "Avoid Tolls"} active={avoidTolls} onClick={() => setAvoidTolls(!avoidTolls)} />
        <Chip label="Fastest" active />
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Departure Time</p>
              <p className="text-xs text-muted-foreground">Optional. Entered and analyzed in India time.</p>
            </div>
            {departureTime && (
              <button
                type="button"
                onClick={() => setDepartureTime("")}
                className="text-xs font-medium text-primary"
              >
                Clear
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {presetStates.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={preset.disabled}
                onClick={() => applyDeparturePreset(preset.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  preset.disabled
                    ? "bg-muted/60 text-muted-foreground/60 cursor-not-allowed"
                    : "bg-muted text-foreground hover:bg-primary/10 hover:text-primary"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={formatIndiaDateTimeInput(departureTime)}
            min={minimumDepartureTime}
            onChange={(e) => {
              setDepartureTime(e.target.value);
              validateDepartureTime(e.target.value);
            }}
            className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Telangana/India timezone is used even if your device timezone is different.
          </p>
          {departureTimeError && (
            <p className="mt-2 text-xs text-destructive">{departureTimeError}</p>
          )}
        </div>
      </div>

      {/* AI Suggestion */}
      <div className="px-4 py-3">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-primary">AI Traffic Insight</p>
            <p className="text-xs text-muted-foreground mt-0.5">{aiSuggestion}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4">
          <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2">{error}</p>
        </div>
      )}

      {/* Search Button */}
      <div className="px-4 py-3">
        <button
          onClick={handleSearch}
          disabled={loading || !destination}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? "Finding Routes..." : "Find Routes"}
        </button>
      </div>

      {/* Quick Places */}
      <div className="px-4 pt-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Popular</h3>
        <div className="flex flex-wrap gap-2">
          {["Charminar", "Hitech City", "Gachibowli", "Secunderabad", "LB Nagar", "Golconda Fort"].map((place) => (
            <button
              key={place}
              onClick={() => {
                setDestination(place);
                setSelectedDestPlaceId(null);
                setSuggestions([]);
                setError("");
              }}
              className="bg-muted text-muted-foreground px-3 py-1.5 rounded-full text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {place}
            </button>
          ))}
        </div>
      </div>

      {recentTrips.length > 0 && (
        <div className="px-4 pt-5 pb-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Trips</h3>
            <button
              type="button"
              onClick={() => persistRecentTrips(() => [])}
              className="text-[11px] font-medium text-primary"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2">
            {recentTrips.map((trip) => (
              <button
                key={trip.id}
                type="button"
                onClick={() => applyRecentTrip(trip)}
                className="w-full rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                    <History className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {trip.sourceName} to {trip.destinationName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {trip.vehicle} trip
                    </p>
                    {trip.departureTime && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatIndiaDateTime(trip.departureTime)}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Chip = ({ label, icon: Icon, active, onClick }: { label: string; icon?: LucideIcon; active?: boolean; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
      active ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
    }`}
  >
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {label}
  </button>
);

export default RoutePlanning;
