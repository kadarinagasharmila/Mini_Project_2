import { useEffect, useState } from "react";
import { ArrowLeft, AlertTriangle, Ban, Car, CircleAlert, CloudRain, Construction, Loader2, MapPin, Shield, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ReportIncidentSheet from "@/components/ReportIncidentSheet";
import { getLiveTrafficIncidents, getUserLocation, TrafficIncident } from "@/services/routingService";

const fallbackIncidents: TrafficIncident[] = [
  {
    id: "demo-accident",
    type: "accident",
    description: "Recent accident reported near Gachibowli. Expect slow movement.",
    latitude: 17.4401,
    longitude: 78.3489,
    severity: "high",
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    source: "sample",
  },
  {
    id: "demo-construction",
    type: "construction",
    description: "Road work causing lane narrowing on NH65.",
    latitude: 17.4688,
    longitude: 78.4192,
    severity: "medium",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: "sample",
  },
];

const typeMeta: Record<string, { label: string; icon: typeof AlertTriangle }> = {
  accident: { label: "Accident", icon: Car },
  construction: { label: "Construction", icon: Construction },
  closure: { label: "Road Closure", icon: Ban },
  congestion: { label: "Congestion", icon: Car },
  police: { label: "Police", icon: Shield },
  flood: { label: "Flooding", icon: CloudRain },
  pothole: { label: "Pothole", icon: CircleAlert },
  other: { label: "Incident", icon: AlertTriangle },
};

const severityColors: Record<string, string> = {
  high: "bg-traffic-heavy text-destructive-foreground",
  heavy: "bg-traffic-heavy text-destructive-foreground",
  medium: "bg-traffic-moderate text-warning-foreground",
  moderate: "bg-traffic-moderate text-warning-foreground",
  low: "bg-traffic-free text-success-foreground",
  light: "bg-traffic-free text-success-foreground",
};

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const TrafficReports = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLocation, setReportLocation] = useState<[number, number]>();

  useEffect(() => {
    let cancelled = false;

    const loadIncidents = async () => {
      try {
        const liveIncidents = await getLiveTrafficIncidents({ limit: 100 });

        if (cancelled) return;

        setUsingFallback(false);
        setIncidents(liveIncidents);
      } catch {
        if (cancelled) return;
        setUsingFallback(true);
        setIncidents(fallbackIncidents);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadIncidents();
    const intervalId = window.setInterval(loadIncidents, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const openReportSheet = async () => {
    try {
      const location = await getUserLocation();
      setReportLocation(location);
    } catch {
      setReportLocation([17.385, 78.4867]);
      toast.info("Using Hyderabad center because GPS is unavailable.");
    }
    setReportOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="touch-target -ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Traffic Reports</h1>
          <p className="text-xs text-muted-foreground">Realtime community accident and road hazard feed</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <button
          onClick={openReportSheet}
          className="w-full bg-warning text-warning-foreground py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-4 active:scale-[0.98] transition-transform"
        >
          <AlertTriangle className="w-4 h-4" /> Report an Incident
        </button>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Incidents</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
            <Wifi className="h-3 w-3" />
            {usingFallback ? "Sample feed" : "TomTom + community"}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No active incidents nearby</p>
            <p className="mt-1 text-xs text-muted-foreground">New community reports will appear here in realtime.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((incident) => {
              const meta = typeMeta[incident.type] || typeMeta.other;
              const Icon = meta.icon;

              return (
                <div key={incident.id} className="premium-card flex items-start gap-3 rounded-2xl p-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${severityColors[incident.severity] || severityColors.medium}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{meta.label}</p>
                      <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                        {incident.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {incident.description || "No description added."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</span>
                      <span>·</span>
                      <span>{formatRelativeTime(incident.created_at)}</span>
                      <span>·</span>
                      <span className="capitalize">{incident.source}</span>
                      {incident.delaySeconds ? (
                        <>
                          <span>·</span>
                          <span>{Math.round(incident.delaySeconds / 60)} min delay</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ReportIncidentSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        location={reportLocation}
      />
    </div>
  );
};

export default TrafficReports;
