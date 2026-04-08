import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import RoutePlanning from "./pages/RoutePlanning";
import RouteResults from "./pages/RouteResults";
import ActiveNavigation from "./pages/ActiveNavigation";
import Favorites from "./pages/Favorites";
import Profile from "./pages/Profile";
import TrafficReports from "./pages/TrafficReports";
import OfflineMaps from "./pages/OfflineMaps";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
