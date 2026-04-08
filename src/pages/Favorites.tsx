import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, MapPin, Navigation, Plus, Trash2, Loader2, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      setFavorites(data || []);
    }
    setLoading(false);
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
    navigate("/plan", {
      state: {
        source: fav.source_name || "Current Location",
        destination: fav.dest_name,
        sourceCoords: fav.source_coords as [number, number],
        destCoords: fav.dest_coords as [number, number],
        vehicle: fav.vehicle_type || "car",
      },
    });
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20 flex flex-col items-center justify-center px-6">
        <Star className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">Sign in to view favorites</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">Save your frequent routes for quick access</p>
        <button
          onClick={() => navigate("/auth")}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
        >
          <LogIn className="w-4 h-4" /> Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-foreground">Favorites</h1>
        <p className="text-xs text-muted-foreground mt-1">Your saved routes</p>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No saved routes yet</p>
            <p className="text-xs text-muted-foreground mt-1">Navigate a route and save it to favorites</p>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((fav) => (
              <div
                key={fav.id}
                className="floating-card p-3 flex items-center gap-3"
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
