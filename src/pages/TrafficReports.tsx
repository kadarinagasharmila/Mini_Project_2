import { ArrowLeft, AlertTriangle, Construction, CloudRain, Car } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const incidents = [
  { id: 1, type: "accident", title: "Accident on ORR near Gachibowli", time: "15 min ago", severity: "heavy", icon: Car },
  { id: 2, type: "construction", title: "Road work on NH65 Vijayawada Hwy", time: "2 hrs ago", severity: "moderate", icon: Construction },
  { id: 3, type: "weather", title: "Heavy rain near Secunderabad", time: "30 min ago", severity: "moderate", icon: CloudRain },
  { id: 4, type: "accident", title: "Vehicle breakdown on Tankbund", time: "45 min ago", severity: "light", icon: AlertTriangle },
];

const severityColors: Record<string, string> = {
  heavy: "bg-traffic-heavy text-destructive-foreground",
  moderate: "bg-traffic-moderate text-warning-foreground",
  light: "bg-traffic-free text-success-foreground",
};

const TrafficReports = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="touch-target -ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Traffic Reports</h1>
      </div>

      <div className="px-4 pt-4">
        <button className="w-full bg-warning text-warning-foreground py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mb-4 active:scale-[0.98] transition-transform">
          <AlertTriangle className="w-4 h-4" /> Report an Incident
        </button>

        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Incidents</h2>
        <div className="space-y-2">
          {incidents.map((inc) => (
            <div key={inc.id} className="floating-card p-4 flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${severityColors[inc.severity]}`}>
                <inc.icon className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{inc.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{inc.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default TrafficReports;
