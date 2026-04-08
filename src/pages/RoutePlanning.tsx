import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Car, Bike, Bus, Footprints, MapPin, Clock, Star, Search } from "lucide-react";
import BottomNav from "@/components/BottomNav";

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
  const [source, setSource] = useState("");
  const [destination, setDestination] = useState("");

  const handleSearch = () => {
    if (destination) navigate("/results");
  };

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
          <div className="flex items-center gap-3 bg-primary-foreground/15 rounded-lg px-3 py-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-destructive" />
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Where to?"
              className="flex-1 bg-transparent text-primary-foreground placeholder:text-primary-foreground/60 text-sm outline-none"
            />
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
        <Chip label="Avoid Tolls" />
        <Chip label="Fastest" active />
        <Chip label="Shortest" />
      </div>

      {/* Search Button */}
      <div className="px-4 py-3">
        <button
          onClick={handleSearch}
          className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <Search className="w-4 h-4" />
          Find Routes
        </button>
      </div>

      {/* Recent Searches */}
      <div className="px-4 pt-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent</h3>
        <div className="space-y-0.5">
          {recentSearches.map((item) => (
            <button
              key={item.name}
              onClick={() => { setDestination(item.name); }}
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

      <BottomNav />
    </div>
  );
};

const Chip = ({ label, icon: Icon, active }: { label: string; icon?: any; active?: boolean }) => (
  <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
    active ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
  }`}>
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {label}
  </button>
);

export default RoutePlanning;
