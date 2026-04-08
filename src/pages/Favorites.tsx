import { useNavigate } from "react-router-dom";
import { Star, MapPin, Navigation, Home, Briefcase, Plus, Trash2 } from "lucide-react";


const favoriteLocations = [
  { id: 1, name: "Home", address: "Road No. 12, Banjara Hills", icon: Home, category: "home" },
  { id: 2, name: "Office", address: "Hitech City, Madhapur", icon: Briefcase, category: "work" },
  { id: 3, name: "Charminar", address: "Old City, Hyderabad", icon: Star, category: "favorite" },
  { id: 4, name: "Tank Bund", address: "Hussain Sagar, Hyderabad", icon: Star, category: "favorite" },
];

const favoriteRoutes = [
  { id: 1, from: "Home", to: "Office", time: "35 min", distance: "18 km" },
  { id: 2, from: "Home", to: "Charminar", time: "42 min", distance: "24 km" },
];

const Favorites = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground">Favorites</h1>
        <p className="text-xs text-muted-foreground mt-1">Your saved places and routes</p>
      </div>

      {/* Saved Places */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Saved Places</h2>
          <button className="text-xs text-primary font-medium flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        <div className="space-y-1">
          {favoriteLocations.map((loc) => (
            <div key={loc.id} className="flex items-center gap-3 py-3 px-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                loc.category === "home" ? "bg-primary/10" : loc.category === "work" ? "bg-secondary/10" : "bg-warning/10"
              }`}>
                <loc.icon className={`w-4 h-4 ${
                  loc.category === "home" ? "text-primary" : loc.category === "work" ? "text-secondary" : "text-warning"
                }`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{loc.name}</p>
                <p className="text-xs text-muted-foreground">{loc.address}</p>
              </div>
              <button className="touch-target">
                <Navigation className="w-4 h-4 text-primary" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Routes */}
      <div className="px-4 pt-6">
        <h2 className="text-sm font-semibold text-foreground mb-3">Frequent Routes</h2>
        <div className="space-y-2">
          {favoriteRoutes.map((route) => (
            <button
              key={route.id}
              onClick={() => navigate("/results")}
              className="w-full floating-card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground">{route.from} → {route.to}</p>
                <p className="text-xs text-muted-foreground">{route.time} · {route.distance}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      
    </div>
  );
};

export default Favorites;
