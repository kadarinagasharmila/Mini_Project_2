import { Locate, AlertTriangle, PlusCircle } from "lucide-react";

interface MapControlsProps {
  onLocate: () => void;
  trafficOn: boolean;
  onToggleTraffic: () => void;
  onReportIncident?: () => void;
}

const MapControls = ({ onLocate, trafficOn, onToggleTraffic, onReportIncident }: MapControlsProps) => {
  return (
    <div className="fixed right-4 bottom-24 z-[500] flex flex-col gap-2">
      {onReportIncident && (
        <button onClick={onReportIncident} className="map-control-btn w-11 h-11" title="Report incident">
          <PlusCircle className="w-5 h-5 text-primary" />
        </button>
      )}
      <button
        onClick={onToggleTraffic}
        className={`map-control-btn relative w-11 h-11 ${trafficOn ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
        title="Toggle traffic"
      >
        <AlertTriangle className={`w-5 h-5 ${trafficOn ? "text-primary" : "text-muted-foreground"}`} />
        {trafficOn && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary" />}
      </button>
      <button onClick={onLocate} className="map-control-btn w-11 h-11" title="Locate me">
        <Locate className="w-5 h-5 text-primary" />
      </button>
    </div>
  );
};

export default MapControls;
