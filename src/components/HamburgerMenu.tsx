import { Menu, AlertTriangle, Download, HelpCircle, MessageSquare, Settings, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { path: "/traffic", icon: AlertTriangle, label: "Traffic Reports" },
  { path: "/offline", icon: Download, label: "Offline Maps" },
  { path: "/profile", icon: Settings, label: "App Settings" },
  { path: "/profile", icon: HelpCircle, label: "Help & Support" },
  { path: "/profile", icon: MessageSquare, label: "Feedback" },
];

const HamburgerMenu = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <button onClick={() => setOpen(true)} className="map-control-btn w-11 h-11">
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000]" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-foreground/30" />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 bg-card shadow-2xl animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground text-lg">TelanganaMaps</h2>
                <p className="text-xs text-muted-foreground">Navigate Telangana smarter</p>
              </div>
              <button onClick={() => setOpen(false)} className="touch-target">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="py-2">
              {menuItems.map(({ path, icon: Icon, label }) => (
                <button
                  key={label}
                  onClick={() => { navigate(path); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-foreground"
                >
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HamburgerMenu;
