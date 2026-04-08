import { ArrowLeft, Clock, MapPin, Navigation, Share2, Star, IndianRupee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MapView from "@/components/MapView";
import BottomNav from "@/components/BottomNav";

const routes = [
  {
    id: 1,
    name: "Via ORR (Recommended)",
    duration: "42 min",
    distance: "28.4 km",
    toll: "₹65",
    traffic: "Light traffic",
    trafficColor: "text-traffic-free",
    eta: "10:42 AM",
    recommended: true,
  },
  {
    id: 2,
    name: "Via NH65",
    duration: "55 min",
    distance: "24.1 km",
    toll: "Free",
    traffic: "Moderate traffic",
    trafficColor: "text-traffic-moderate",
    eta: "10:55 AM",
  },
  {
    id: 3,
    name: "Via Inner Ring Road",
    duration: "1h 10min",
    distance: "19.8 km",
    toll: "Free",
    traffic: "Heavy traffic",
    trafficColor: "text-traffic-heavy",
    eta: "11:10 AM",
  },
];

const RouteResults = () => {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col">
      {/* Map Section */}
      <div className="relative h-[45%]">
        <MapView />
        <button
          onClick={() => navigate("/plan")}
          className="absolute top-4 left-4 z-[500] map-control-btn w-10 h-10"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="absolute top-4 left-16 right-4 z-[500] floating-card px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-secondary" />
            <span>Your location</span>
            <span className="text-muted-foreground/50">→</span>
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span>Charminar</span>
          </div>
        </div>
      </div>

      {/* Routes Bottom Sheet */}
      <div className="flex-1 bottom-sheet -mt-4 overflow-y-auto pb-20">
        <div className="w-10 h-1 bg-border rounded-full mx-auto mt-3 mb-4" />
        <div className="px-4 pb-4">
          <h2 className="text-base font-semibold text-foreground mb-3">3 routes found</h2>
          <div className="space-y-3">
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => navigate("/navigate")}
                className={`w-full text-left floating-card p-4 transition-all active:scale-[0.98] ${
                  route.recommended ? "ring-2 ring-primary" : ""
                }`}
              >
                {route.recommended && (
                  <span className="inline-block bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2">
                    AI Recommended
                  </span>
                )}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{route.name}</h3>
                    <p className={`text-xs font-medium mt-0.5 ${route.trafficColor}`}>{route.traffic}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">{route.duration}</p>
                    <p className="text-xs text-muted-foreground">ETA {route.eta}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{route.distance}</span>
                  <span className="flex items-center gap-1"><IndianRupee className="w-3 h-3" />{route.toll}</span>
                </div>
                {route.recommended && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate("/navigate"); }}
                      className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Navigation className="w-3.5 h-3.5" /> Start
                    </button>
                    <button onClick={(e) => e.stopPropagation()} className="w-10 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Share2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button onClick={(e) => e.stopPropagation()} className="w-10 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Star className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default RouteResults;
