import { useMemo, useState } from "react";
import { Heart, MapPin, Search, Trash2 } from "lucide-react";
import { SavedRoute, deleteSavedRoute } from "@/services/routingService";
import { toast } from "sonner";

interface SavedRoutesPanelProps {
  savedRoutes: SavedRoute[];
  onSelect: (route: SavedRoute) => void;
  onDelete: (id: string) => void;
  onSaveCurrent?: () => void;
}

const SavedRoutesPanel = ({ savedRoutes, onSelect, onDelete, onSaveCurrent }: SavedRoutesPanelProps) => {
  const [query, setQuery] = useState("");
  const filteredRoutes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedRoutes;

    return savedRoutes.filter((route) => {
      const haystack = `${route.name} ${route.sourceLabel} ${route.destLabel} ${route.vehicle}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, savedRoutes]);

  const handleDelete = (id: string) => {
    deleteSavedRoute(id);
    onDelete(id);
    toast.success("Route deleted");
  };

  const formatSavedTime = (route: SavedRoute) => {
    const value = route.lastUsedAt || route.savedAt;
    if (!value) return "";

    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (savedRoutes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No saved routes yet</p>
        <p className="text-xs">Save your favorite trips for quick access</p>
        {onSaveCurrent && (
          <button
            type="button"
            onClick={onSaveCurrent}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Heart className="w-3.5 h-3.5" />
            Save current route
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${savedRoutes.length} saved route${savedRoutes.length === 1 ? "" : "s"}`}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground outline-none focus:border-primary"
        />
      </div>

      {filteredRoutes.length === 0 && (
        <div className="rounded-lg bg-muted/50 p-4 text-center text-xs text-muted-foreground">
          No saved routes match that search.
        </div>
      )}

      {filteredRoutes.map((route) => (
        <div
          key={route.id}
          className="flex items-center justify-between bg-muted/50 rounded-lg p-3 hover:bg-muted cursor-pointer transition-colors"
          onClick={() => onSelect(route)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{route.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3" />
              <span className="truncate">
                {route.sourceLabel} → {route.destLabel}
              </span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">
              {route.vehicle} · Used {route.timesUsed} time{route.timesUsed !== 1 ? "s" : ""}
              {formatSavedTime(route) ? ` · ${formatSavedTime(route)}` : ""}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(route.id);
            }}
            className="ml-2 p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default SavedRoutesPanel;
