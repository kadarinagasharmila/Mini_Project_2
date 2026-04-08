import { Map, Route, Star, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const navItems = [
  { path: "/", icon: Map, label: "Map" },
  { path: "/plan", icon: Route, label: "Plan" },
  { path: "/favorites", icon: Star, label: "Favorites" },
  { path: "/profile", icon: User, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Hide during active navigation
  if (location.pathname === "/navigate" || location.pathname === "/auth") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[1000] bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`touch-target flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
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
