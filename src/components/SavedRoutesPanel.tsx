import { Heart, MapPin, Trash2 } from "lucide-react";
import { SavedRoute, deleteSavedRoute } from "@/services/routingService";
import { toast } from "sonner";

interface SavedRoutesPanelProps {
  savedRoutes: SavedRoute[];
  onSelect: (route: SavedRoute) => void;
  onDelete: (id: string) => void;
}

const SavedRoutesPanel = ({ savedRoutes, onSelect, onDelete }: SavedRoutesPanelProps) => {
  const handleDelete = (id: string) => {
    deleteSavedRoute(id);
    onDelete(id);
    toast.success("Route deleted");
  };

  if (savedRoutes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No saved routes yet</p>
        <p className="text-xs">Save your favorite trips for quick access</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {savedRoutes.map((route) => (
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
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Used {route.timesUsed} time{route.timesUsed !== 1 ? "s" : ""}
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
