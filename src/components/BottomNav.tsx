import { Map, Route, Star } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { path: "/", icon: Map, label: "Map" },
  { path: "/plan", icon: Route, label: "Plan" },
  { path: "/favorites", icon: Star, label: "Saved" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide only on Auth page
  if (location.pathname === "/auth") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] safe-bottom px-3 pb-1">
      <div className="mx-auto flex max-w-lg items-center justify-around rounded-2xl border border-white/70 bg-card/90 px-1 py-1 shadow-[0_12px_36px_rgba(15,23,42,0.16)] backdrop-blur-xl">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`touch-target relative flex-1 flex-col gap-0.5 rounded-xl py-2 transition-colors ${
                isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60"
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
