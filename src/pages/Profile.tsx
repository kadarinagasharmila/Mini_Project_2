import { User, Car, Globe, Bell, Download, ChevronRight, LogOut, Info, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const settingsGroups = [
  {
    title: "Preferences",
    items: [
      { icon: Car, label: "Default Vehicle", value: "Car" },
      { icon: Globe, label: "Voice Language", value: "English" },
      { icon: Bell, label: "Traffic Alerts", value: "On" },
      { icon: Download, label: "Offline Maps", value: "2 regions" },
    ],
  },
  {
    title: "App",
    items: [
      { icon: Info, label: "About TelanganaMaps", value: "v1.0" },
    ],
  },
];

const Profile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Profile Header */}
      <div className="bg-primary px-4 pt-8 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            {user ? (
              <>
                <h1 className="text-lg font-bold text-primary-foreground">
                  {user.user_metadata?.full_name || user.email?.split("@")[0]}
                </h1>
                <p className="text-xs text-primary-foreground/70">{user.email}</p>
              </>
            ) : (
              <>
                <h1 className="text-lg font-bold text-primary-foreground">Guest User</h1>
                <button
                  onClick={() => navigate("/auth")}
                  className="text-xs text-primary-foreground/70 underline mt-0.5"
                >
                  Sign in to save your data
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sign In Button for Guests */}
      {!user && (
        <div className="px-4 pt-4">
          <button
            onClick={() => navigate("/auth")}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Sign In / Create Account
          </button>
        </div>
      )}

      {/* Settings */}
      <div className="px-4 pt-4 space-y-6">
        {settingsGroups.map((group) => (
          <div key={group.title}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group.title}</h2>
            <div className="floating-card divide-y divide-border">
              {group.items.map((item) => (
                <button key={item.label} className="w-full flex items-center gap-3 px-4 py-3.5">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <span className="flex-1 text-sm text-foreground text-left">{item.label}</span>
                  <span className="text-xs text-muted-foreground mr-1">{item.value}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {user && (
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 text-destructive text-sm font-medium"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
