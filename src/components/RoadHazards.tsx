import { AlertTriangle, AlertCircle, Zap, Construction, ShieldAlert } from "lucide-react";
import { RoadHazard } from "@/services/routingService";

interface RoadHazardsProps {
  hazards: RoadHazard[];
}

const HazardIcon = ({ type }: { type: RoadHazard["type"] }) => {
  switch (type) {
    case "speedcamera":
      return <Zap className="w-4 h-4" />;
    case "construction":
      return <Construction className="w-4 h-4" />;
    case "accident":
      return <AlertTriangle className="w-4 h-4" />;
    case "pothole":
      return <AlertCircle className="w-4 h-4" />;
    default:
      return null;
  }
};

const severityStyles = {
  high: "bg-destructive/20 text-destructive",
  medium: "bg-warning/20 text-warning",
  low: "bg-info/20 text-info",
};

const getHazardLabel = (type: RoadHazard["type"]) => {
  if (type === "speedcamera") return "Speed camera";
  return type.replace(/([A-Z])/g, " $1").trim();
};

const RoadHazards = ({ hazards }: RoadHazardsProps) => {
  if (hazards.length === 0) return null;

  const counts = hazards.reduce(
    (acc, hazard) => {
      acc[hazard.severity] += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );
  const highestSeverity = counts.high > 0 ? "high" : counts.medium > 0 ? "medium" : "low";
  const advisory =
    highestSeverity === "high"
      ? "Slow down and keep extra distance through the marked stretch."
      : highestSeverity === "medium"
        ? "Expect mild delays and watch for lane changes."
        : "Route looks manageable, but stay alert near the listed points.";

  return (
    <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 mb-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <div>
            <p className="text-sm font-semibold text-warning">Road Hazards on Route</p>
            <p className="text-[11px] text-muted-foreground">
              {hazards.length} alert{hazards.length === 1 ? "" : "s"} found near this route
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap capitalize ${severityStyles[highestSeverity]}`}>
          {highestSeverity} risk
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <HazardCount label="High" value={counts.high} severity="high" />
        <HazardCount label="Medium" value={counts.medium} severity="medium" />
        <HazardCount label="Low" value={counts.low} severity="low" />
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-lg bg-background/80 px-3 py-2 text-[11px] text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <span>{advisory}</span>
      </div>

      <div className="space-y-2">
        {hazards.map((hazard) => (
          <div key={hazard.id} className="flex items-start gap-2 bg-warning/5 rounded-lg p-2">
            <div className="mt-0.5 text-warning">
              <HazardIcon type={hazard.type} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground capitalize">
                {getHazardLabel(hazard.type)}
              </p>
              {hazard.description && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{hazard.description}</p>
              )}
            </div>
            <span className={`text-[10px] font-semibold px-2 py-1 rounded whitespace-nowrap ${severityStyles[hazard.severity]}`}>
              {hazard.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const HazardCount = ({
  label,
  value,
  severity,
}: {
  label: string;
  value: number;
  severity: RoadHazard["severity"];
}) => (
  <div className="rounded-lg bg-background/80 px-2 py-2 text-center">
    <p className={`text-sm font-bold ${severityStyles[severity].split(" ")[1]}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default RoadHazards;
