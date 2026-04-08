import { Search, Mic } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HamburgerMenu from "./HamburgerMenu";

const SearchBar = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed top-4 left-4 right-4 z-[500] flex items-center gap-2">
      <HamburgerMenu />
      <button
        onClick={() => navigate("/plan")}
        className="flex-1 floating-card flex items-center gap-3 px-4 py-3"
      >
        <Search className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Where to?</span>
      </button>
      <button className="map-control-btn w-11 h-11">
        <Mic className="w-5 h-5 text-primary" />
      </button>
    </div>
  );
};

export default SearchBar;
