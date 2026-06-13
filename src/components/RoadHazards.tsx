import { AlertTriangle, AlertCircle, Zap, Construction, ShieldAlert, Ban, Car } from "lucide-react";
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
    case "closure":
      return <Ban className="w-4 h-4" />;
    case "congestion":
      return <Car className="w-4 h-4" />;
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
  if (type === "closure") return "Road closure";
  if (type === "congestion") return "Congestion";
  return type.replace(/([A-Z])/g, " $1").trim();
};

const RoadHazards = ({ hazards }: RoadHazardsProps) => {
  if (hazards.length === 0) return null;

  const visibleHazards = hazards.slice(0, 5);
  const hiddenHazardCount = Math.max(0, hazards.length - visibleHazards.length);
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
    <div className="premium-card mb-3 rounded-2xl p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <AlertTriangle className="w-4 h-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Road Hazards</p>
            <p className="text-[11px] text-muted-foreground">
              {hazards.length} live alert{hazards.length === 1 ? "" : "s"} near this route
            </p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize whitespace-nowrap ${severityStyles[highestSeverity]}`}>
          {highestSeverity} risk
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <HazardCount label="High" value={counts.high} severity="high" />
        <HazardCount label="Medium" value={counts.medium} severity="medium" />
        <HazardCount label="Low" value={counts.low} severity="low" />
      </div>

      <div className="mb-3 flex items-start gap-2 rounded-xl bg-background/80 px-3 py-2 text-[11px] text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
        <span>{advisory}</span>
      </div>

      <div className="space-y-2">
        {visibleHazards.map((hazard) => (
          <div key={hazard.id} className="flex items-start gap-2 rounded-xl border border-border/70 bg-background/70 p-2.5">
            <div className="mt-0.5 rounded-full bg-warning/10 p-1.5 text-warning">
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
        {hiddenHazardCount > 0 && (
          <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
            {hiddenHazardCount} more live alert{hiddenHazardCount === 1 ? "" : "s"} near this route
          </div>
        )}
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
  <div className="stat-chip text-center">
    <p className={`text-sm font-bold ${severityStyles[severity].split(" ")[1]}`}>{value}</p>
    <p className="text-[10px] text-muted-foreground">{label}</p>
  </div>
);

export default RoadHazards;
