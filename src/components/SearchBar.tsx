import { type FormEvent, useState } from "react";
import { Mic, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import HamburgerMenu from "./HamburgerMenu";

const SearchBar = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const openRoutePlanning = (value: string) => {
    const trimmedQuery = value.trim();
    navigate(
      trimmedQuery
        ? `/plan?destination=${encodeURIComponent(trimmedQuery)}`
        : "/plan"
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    openRoutePlanning(query);
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-[500] flex items-center gap-2">
      <HamburgerMenu />
      <form
        onSubmit={handleSubmit}
        onClick={() => openRoutePlanning(query)}
        className="floating-card flex flex-1 items-center gap-3 px-4 py-3"
      >
        <Search className="w-5 h-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => openRoutePlanning(query)}
          placeholder="Where to?"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button type="submit" className="sr-only">
          Search
        </button>
      </form>
      <button
        type="button"
        onClick={() => navigate("/plan")}
        className="map-control-btn w-11 h-11"
        aria-label="Open route search"
      >
        <Mic className="w-5 h-5 text-primary" />
      </button>
    </div>
  );
};

export default SearchBar;
