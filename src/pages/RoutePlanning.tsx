import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Bike, Bus, Footprints, MapPin, Clock, Search, Sparkles } from "lucide-react";

import { geocodeLocation, getOptimalDeparture, TELANGANA_LOCATIONS } from "@/services/routingService";

const vehicleTypes = [
  { id: "car", icon: Car, label: "Car" },
  { id: "bike", icon: Bike, label: "Bike" },
  { id: "bus", icon: Bus, label: "Bus" },
  { id: "walk", icon: Footprints, label: "Walk" },
];

const recentSearches = [
  { name: "Charminar", subtitle: "Old City, Hyderabad" },
  { name: "Hitech City", subtitle: "Madhapur, Hyderabad" },
  { name: "Warangal Fort", subtitle: "Warangal, Telangana" },
  { name: "Shamirpet Lake", subtitle: "Shamirpet, Hyderabad" },
];

const RoutePlanning = () => {
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState("car");
  const [source, setSource] = useState("My Location");
  const [destination, setDestination] = useState("");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const aiSuggestion = getOptimalDeparture(20);

  const handleSearch = async () => {
    if (!destination) return;

    const destCoords = geocodeLocation(destination);
    if (!destCoords) {
      setError(`Location "${destination}" not found in Telangana. Try: ${Object.keys(TELANGANA_LOCATIONS).slice(0, 5).join(", ")}`);
      return;
    }

    setError("");
    setLoading(true);

    // Get user location or default to Hyderabad center
    let srcCoords: [number, number] = [17.385, 78.4867];
    if (source && source !== "My Location") {
      const sc = geocodeLocation(source);
      if (sc) srcCoords = sc;
    } else {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 })
        );
        srcCoords = [pos.coords.latitude, pos.coords.longitude];
      } catch {}
    }

    navigate("/results", {
      state: { source: srcCoords, destination: destCoords, vehicle, destName: destination, avoidTolls },
    });
  };

  // Filter suggestions based on input
  const suggestions = destination.length >= 2
    ? Object.keys(TELANGANA_LOCATIONS).filter(loc => 
        loc.includes(destination.toLowerCase()) && loc !== destination.toLowerCase()
      ).slice(0, 4)
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      {/* Header */}
      <div className="bg-primary px-4 pt-4 pb-6">
        <button onClick={() => navigate("/")} className="touch-target -ml-2 mb-2">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="space-y-2">
          <div className="flex items-center gap-3 bg-primary-foreground/15 rounded-lg px-3 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Your location"
              className="flex-1 bg-transparent text-primary-foreground placeholder:text-primary-foreground/60 text-sm outline-none"
            />
          </div>
          <div className="relative">
            <div className="flex items-center gap-3 bg-primary-foreground/15 rounded-lg px-3 py-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
              <input
                value={destination}
                onChange={(e) => { setDestination(e.target.value); setError(""); }}
                placeholder="Where to? (e.g. Charminar, Hitech City)"
                className="flex-1 bg-transparent text-primary-foreground placeholder:text-primary-foreground/60 text-sm outline-none"
              />
            </div>
            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => { setDestination(loc.charAt(0).toUpperCase() + loc.slice(1)); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    {loc.charAt(0).toUpperCase() + loc.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <Chip label="Depart Now" icon={Clock} active />
        <Chip label="Avoid Tolls" active={avoidTolls} onClick={() => setAvoidTolls(!avoidTolls)} />
        <Chip label="Fastest" active />
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
            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          {loading ? "Finding Routes..." : "Find Routes"}
        </button>
      </div>

      {/* Recent Searches */}
      <div className="px-4 pt-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent</h3>
        <div className="space-y-0.5">
          {recentSearches.map((item) => (
            <button
              key={item.name}
              onClick={() => setDestination(item.name)}
              className="w-full flex items-center gap-3 py-3 px-1 hover:bg-muted rounded-lg transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
                <MapPin className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      
    </div>
  );
};

const Chip = ({ label, icon: Icon, active, onClick }: { label: string; icon?: any; active?: boolean; onClick?: () => void }) => (
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
