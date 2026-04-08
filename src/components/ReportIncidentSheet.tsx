import { useState } from "react";
import { AlertTriangle, Construction, Shield, Droplets, CircleAlert, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const INCIDENT_TYPES = [
  { id: "accident", label: "Accident", icon: AlertTriangle },
  { id: "construction", label: "Construction", icon: Construction },
  { id: "police", label: "Police", icon: Shield },
  { id: "flood", label: "Flooding", icon: Droplets },
  { id: "pothole", label: "Pothole", icon: CircleAlert },
];

interface Props {
  open: boolean;
  onClose: () => void;
  location: [number, number] | undefined;
}

const ReportIncidentSheet = ({ open, onClose, location }: Props) => {
  const { user } = useAuth();
  const [type, setType] = useState("accident");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Sign in to report incidents");
      return;
    }
    if (!location) {
      toast.error("Location not available");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("traffic_incidents").insert({
      user_id: user.id,
      type,
      description: description || null,
      latitude: location[0],
      longitude: location[1],
      severity,
    });

    if (error) {
      toast.error("Failed to report incident");
      console.error(error);
    } else {
      toast.success("Incident reported! Other users will see it on the map.");
      onClose();
      setDescription("");
      setType("accident");
      setSeverity("medium");
    }
    setSubmitting(false);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[600] bg-card rounded-t-2xl p-4 shadow-xl safe-bottom animate-in slide-in-from-bottom">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Report Incident</h3>
        <button onClick={onClose} className="touch-target"><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Type */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {INCIDENT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium shrink-0 transition-colors ${
              type === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Severity */}
      <div className="flex gap-2 mb-4">
        {["low", "medium", "high"].map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
              severity === s
                ? s === "high" ? "bg-destructive text-destructive-foreground"
                : s === "medium" ? "bg-warning text-warning-foreground"
                : "bg-secondary text-secondary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional description..."
        className="w-full bg-muted rounded-lg px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 resize-none h-16 mb-4"
      />

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
      >
        {submitting ? "Reporting..." : "Report Incident"}
      </button>
    </div>
  );
};

export default ReportIncidentSheet;
