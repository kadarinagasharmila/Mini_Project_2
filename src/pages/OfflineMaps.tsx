import { ArrowLeft, Download, Trash2, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

const regions = [
  { name: "Hyderabad City", size: "145 MB", downloaded: true },
  { name: "Secunderabad & Cantonment", size: "82 MB", downloaded: true },
  { name: "Warangal District", size: "120 MB", downloaded: false },
  { name: "Karimnagar District", size: "95 MB", downloaded: false },
  { name: "Nizamabad District", size: "88 MB", downloaded: false },
  { name: "Khammam District", size: "76 MB", downloaded: false },
];

const OfflineMaps = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="touch-target -ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Offline Maps</h1>
      </div>

      <div className="px-4 pt-4">
        <div className="floating-card p-4 mb-4 flex items-center gap-3">
          <Wifi className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Download over Wi-Fi only</p>
            <p className="text-xs text-muted-foreground">Save mobile data</p>
          </div>
          <div className="w-10 h-6 bg-primary rounded-full relative">
            <div className="absolute right-0.5 top-0.5 w-5 h-5 bg-primary-foreground rounded-full" />
          </div>
        </div>

        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Available Regions</h2>
        <div className="space-y-1">
          {regions.map((region) => (
            <div key={region.name} className="flex items-center gap-3 py-3 px-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                region.downloaded ? "bg-secondary/10" : "bg-muted"
              }`}>
                {region.downloaded ? (
                  <Trash2 className="w-4 h-4 text-destructive" />
                ) : (
                  <Download className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{region.name}</p>
                <p className="text-xs text-muted-foreground">{region.size}</p>
              </div>
              {region.downloaded && (
                <span className="text-[10px] font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                  Downloaded
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default OfflineMaps;
