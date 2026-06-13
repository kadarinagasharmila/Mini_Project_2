import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Navigation, Trash2, Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { deleteSavedRoute, getSavedRoutes, SavedRoute } from "@/services/routingService";

interface FavoriteRoute {
  id: string;
  name: string;
  source_name: string | null;
  source_coords: number[];
  dest_name: string;
  dest_coords: number[];
  vehicle_type: string | null;
  created_at: string;
}

const Favorites = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteRoute[]>([]);
  const [localRoutes, setLocalRoutes] = useState<SavedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    setLocalRoutes(getSavedRoutes());

    if (!user) {
      setLoading(false);
      return;
    }
    fetchFavorites();
  }, [user]);

  const fetchFavorites = async () => {
    const { data, error } = await supabase
      .from("favorite_routes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load favorites");
      console.error(error);
    } else {
      const cloudFavorites = data || [];
      setFavorites(cloudFavorites);
      await syncLocalRoutesToCloud(cloudFavorites);
    }
    setLoading(false);
  };

  const syncLocalRoutesToCloud = async (cloudFavorites: FavoriteRoute[]) => {
    const deviceRoutes = getSavedRoutes();
    if (!user || deviceRoutes.length === 0 || syncedUserRef.current === user.id) return;

    const cloudKeys = new Set(
      cloudFavorites.map((fav) => getRouteKey(fav.source_coords, fav.dest_coords, fav.vehicle_type))
    );
    const missingRoutes = deviceRoutes.filter(
      (route) => !cloudKeys.has(getRouteKey(route.source, route.destination, route.vehicle))
    );

    if (missingRoutes.length === 0) {
      syncedUserRef.current = user.id;
      return;
    }

    const { error } = await supabase.from("favorite_routes").insert(
      missingRoutes.map((route) => ({
        user_id: user.id,
        name: route.name,
        source_name: route.sourceLabel,
        source_coords: route.source,
        dest_name: route.destLabel,
        dest_coords: route.destination,
        vehicle_type: route.vehicle,
      }))
    );

    syncedUserRef.current = user.id;

    if (error) {
      toast.warning("Device routes are saved locally. Cloud sync failed.");
      return;
    }

    toast.success("Device saved routes synced");
    const { data } = await supabase
      .from("favorite_routes")
      .select("*")
      .order("created_at", { ascending: false });
    setFavorites(data || cloudFavorites);
  };

  const deleteFavorite = async (id: string) => {
    const { error } = await supabase.from("favorite_routes").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      toast.success("Removed from favorites");
    }
  };

  const navigateToRoute = (fav: FavoriteRoute) => {
    navigate("/results", {
      state: {
        source: fav.source_coords as [number, number],
        destination: fav.dest_coords as [number, number],
        sourceName: fav.source_name || "Current Location",
        destName: fav.dest_name,
        vehicle: fav.vehicle_type || "car",
        avoidTolls: false,
        departureTime: null,
      },
    });
  };

  const navigateToLocalRoute = (route: SavedRoute) => {
    navigate("/results", {
      state: {
        source: route.source,
        destination: route.destination,
        sourceName: route.sourceLabel,
        destName: route.destLabel,
        vehicle: route.vehicle,
        avoidTolls: false,
        departureTime: null,
      },
    });
  };

  const deleteLocalRoute = (id: string) => {
    deleteSavedRoute(id);
    setLocalRoutes(getSavedRoutes());
    toast.success("Removed from saved routes");
  };

  const getRouteKey = (source: number[], destination: number[], vehicle: string | null) =>
    `${source.join(",")}|${destination.join(",")}|${vehicle || "car"}`;

  const favoriteRouteKeys = new Set(
    favorites.map((fav) => getRouteKey(fav.source_coords, fav.dest_coords, fav.vehicle_type))
  );
  const visibleLocalRoutes = user
    ? localRoutes.filter((route) => !favoriteRouteKeys.has(getRouteKey(route.source, route.destination, route.vehicle)))
    : localRoutes;
  const hasSavedRoutes = user
    ? favorites.length > 0 || visibleLocalRoutes.length > 0
    : localRoutes.length > 0;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Saved</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {user ? "Cloud favorites and device routes" : "Routes saved on this device"}
            </p>
          </div>
          {!user && (
            <button
              onClick={() => navigate("/auth")}
              className="btn-primary shrink-0 px-3 py-2 rounded-lg font-semibold text-xs flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !hasSavedRoutes ? (
          <div className="text-center py-12">
            <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No saved routes yet</p>
            <p className="text-xs text-muted-foreground mt-1">Save a route from route results</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleLocalRoutes.map((route) => (
              <div
                key={route.id}
                className="premium-card rounded-2xl p-3 flex items-center gap-3"
              >
                <button
                  onClick={() => navigateToLocalRoute(route)}
                  className="flex-1 flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{route.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {route.sourceLabel} → {route.destLabel}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{route.vehicle}</p>
                  </div>
                </button>
                <button
                  onClick={() => deleteLocalRoute(route.id)}
                  className="touch-target shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
            {user && favorites.map((fav) => (
              <div
                key={fav.id}
                className="premium-card rounded-2xl p-3 flex items-center gap-3"
              >
                <button
                  onClick={() => navigateToRoute(fav)}
                  className="flex-1 flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Navigation className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{fav.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {fav.source_name || "Current"} → {fav.dest_name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{fav.vehicle_type || "car"}</p>
                  </div>
                </button>
                <button
                  onClick={() => deleteFavorite(fav.id)}
                  className="touch-target shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;
