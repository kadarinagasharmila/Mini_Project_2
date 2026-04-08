import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import RoutePlanning from "./pages/RoutePlanning";
import RouteResults from "./pages/RouteResults";
import ActiveNavigation from "./pages/ActiveNavigation";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import TrafficReports from "./pages/TrafficReports";
import OfflineMaps from "./pages/OfflineMaps";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/plan" element={<RoutePlanning />} />
            <Route path="/results" element={<RouteResults />} />
            <Route path="/navigate" element={<ActiveNavigation />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/traffic" element={<TrafficReports />} />
            <Route path="/offline" element={<OfflineMaps />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
