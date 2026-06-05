import { Brain, Gauge, ShieldAlert, Timer } from "lucide-react";
import { RouteMlPrediction } from "@/services/routingService";

interface RouteMlInsightsProps {
  prediction: RouteMlPrediction;
}

const riskClass = {
  low: "text-secondary bg-secondary/10 border-secondary/20",
  medium: "text-warning bg-warning/10 border-warning/20",
  high: "text-destructive bg-destructive/10 border-destructive/20",
};

const fillClass = {
  low: "bg-secondary",
  medium: "bg-warning",
  high: "bg-destructive",
};

const RouteMlInsights = ({ prediction }: RouteMlInsightsProps) => {
  return (
    <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <div>
            <p className="text-xs font-semibold text-primary">Traffic Risk</p>
            <p className="text-[11px] text-muted-foreground">Based on historical traffic, events, weather, and route hazards</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold capitalize ${riskClass[prediction.riskLevel]}`}>
          {prediction.riskLevel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Metric icon={Gauge} label="Risk" value={`${prediction.riskScore}/100`} />
        <Metric icon={Timer} label="Delay" value={`+${prediction.delayMinutes} min`} />
        <Metric icon={ShieldAlert} label="Confidence" value={`${prediction.confidence}%`} />
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
        <div
          className={`h-full rounded-full ${fillClass[prediction.riskLevel]}`}
          style={{ width: `${prediction.riskScore}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {prediction.topFactors.map((factor) => (
          <span key={factor} className="rounded-full bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
            {factor}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{prediction.recommendation}</p>
    </div>
  );
};

const Metric = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg bg-background px-2 py-2">
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
    <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
  </div>
);

export default RouteMlInsights;
