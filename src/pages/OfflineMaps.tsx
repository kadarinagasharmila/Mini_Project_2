import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, HardDrive, Loader2, Map, Trash2, Wifi } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Region = {
  id: string;
  name: string;
  description: string;
  bbox: [number, number, number, number];
  zooms: number[];
};

type DownloadedRegion = {
  id: string;
  downloadedAt: string;
  tileCount: number;
};

const OFFLINE_REGIONS_KEY = "telangana_maps_offline_regions";
const TILE_CACHE_NAME = "routemax-offline-map-tiles-v1";
const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png";

const regions: Region[] = [
  {
    id: "hyderabad-core",
    name: "Hyderabad Core",
    description: "Central Hyderabad, Secunderabad, HITEC City, airport corridor",
    bbox: [17.19, 78.27, 17.57, 78.62],
    zooms: [11, 12, 13],
  },
  {
    id: "warangal",
    name: "Warangal & Hanamkonda",
    description: "Warangal city, Hanamkonda, Kazipet and nearby arterial roads",
    bbox: [17.86, 79.43, 18.08, 79.68],
    zooms: [11, 12, 13],
  },
  {
    id: "karimnagar",
    name: "Karimnagar",
    description: "Karimnagar city and surrounding ring roads",
    bbox: [18.32, 79.02, 18.54, 79.24],
    zooms: [11, 12, 13],
  },
  {
    id: "nizamabad",
    name: "Nizamabad",
    description: "Nizamabad city, bypasses and nearby local routes",
    bbox: [18.56, 77.98, 18.78, 78.20],
    zooms: [11, 12, 13],
  },
  {
    id: "khammam",
    name: "Khammam",
    description: "Khammam city and major approach roads",
    bbox: [17.13, 80.04, 17.35, 80.26],
    zooms: [11, 12, 13],
  },
];

function lngToTileX(lng: number, zoom: number) {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom);
}

function getRegionTiles(region: Region) {
  const [south, west, north, east] = region.bbox;
  const tiles: string[] = [];
  const subdomains = ["a", "b", "c", "d"];

  region.zooms.forEach((zoom) => {
    const minX = lngToTileX(west, zoom);
    const maxX = lngToTileX(east, zoom);
    const minY = latToTileY(north, zoom);
    const maxY = latToTileY(south, zoom);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const subdomain = subdomains[Math.abs(x + y + zoom) % subdomains.length];
        tiles.push(TILE_URL.replace("{s}", subdomain).replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y)));
      }
    }
  });

  return tiles;
}

function getSavedRegions(): DownloadedRegion[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_REGIONS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const OfflineMaps = () => {
  const navigate = useNavigate();
  const [downloadedRegions, setDownloadedRegions] = useState<DownloadedRegion[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [cacheSupported, setCacheSupported] = useState(true);

  useEffect(() => {
    setDownloadedRegions(getSavedRegions());
    setCacheSupported("caches" in window);
  }, []);

  const downloadedIds = useMemo(
    () => new Set(downloadedRegions.map((region) => region.id)),
    [downloadedRegions]
  );

  const totalTiles = useMemo(
    () => downloadedRegions.reduce((sum, region) => sum + region.tileCount, 0),
    [downloadedRegions]
  );

  const persistDownloadedRegions = (next: DownloadedRegion[]) => {
    localStorage.setItem(OFFLINE_REGIONS_KEY, JSON.stringify(next));
    setDownloadedRegions(next);
  };

  const downloadRegion = async (region: Region) => {
    if (!cacheSupported) {
      toast.error("Offline map downloads are not supported in this browser.");
      return;
    }

    const tiles = getRegionTiles(region);
    setActiveRegionId(region.id);
    setProgress(0);

    try {
      const cache = await caches.open(TILE_CACHE_NAME);
      let completed = 0;

      for (const tile of tiles) {
        try {
          const cached = await cache.match(tile);
          if (!cached) {
            const response = await fetch(tile, { mode: "no-cors" });
            await cache.put(tile, response);
          }
        } catch {
          // Keep downloading the rest of the package if one tile fails.
        }

        completed += 1;
        setProgress(Math.round((completed / tiles.length) * 100));
      }

      const next = [
        { id: region.id, downloadedAt: new Date().toISOString(), tileCount: tiles.length },
        ...downloadedRegions.filter((item) => item.id !== region.id),
      ];
      persistDownloadedRegions(next);
      toast.success(`${region.name} map saved for offline use`);
    } catch {
      toast.error("Could not download this map package.");
    } finally {
      setActiveRegionId(null);
      setProgress(0);
    }
  };

  const removeRegion = async (region: Region) => {
    if (!cacheSupported) return;

    const cache = await caches.open(TILE_CACHE_NAME);
    await Promise.all(getRegionTiles(region).map((tile) => cache.delete(tile)));
    persistDownloadedRegions(downloadedRegions.filter((item) => item.id !== region.id));
    toast.success(`${region.name} offline map removed`);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-card border-b border-border px-4 pt-4 pb-4 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="touch-target -ml-2">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Offline Maps</h1>
          <p className="text-xs text-muted-foreground">Download map tiles before low-network trips</p>
        </div>
      </div>

      <div className="px-4 pt-4">
        <div className="floating-card p-4 mb-4 flex items-center gap-3">
          <Wifi className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Download when you need it</p>
            <p className="text-xs text-muted-foreground">
              Tiles are stored in this browser cache and reused by the map when available.
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-primary">
              <Map className="h-4 w-4" />
              <span className="text-xs font-semibold">Regions</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{downloadedRegions.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-primary">
              <HardDrive className="h-4 w-4" />
              <span className="text-xs font-semibold">Tiles</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{totalTiles}</p>
          </div>
        </div>

        {!cacheSupported && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            Your browser does not support offline map tile storage.
          </div>
        )}

        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Available Regions</h2>
        <div className="space-y-2">
          {regions.map((region) => {
            const downloaded = downloadedIds.has(region.id);
            const active = activeRegionId === region.id;
            const tileCount = getRegionTiles(region).length;
            const saved = downloadedRegions.find((item) => item.id === region.id);

            return (
              <div key={region.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    disabled={activeRegionId !== null || !cacheSupported}
                    onClick={() => downloaded ? removeRegion(region) : downloadRegion(region)}
                    className={`mt-0.5 w-10 h-10 rounded-full flex items-center justify-center ${
                      downloaded ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                    } disabled:opacity-50`}
                    title={downloaded ? "Remove offline map" : "Download offline map"}
                  >
                    {active ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : downloaded ? (
                      <Trash2 className="w-4 h-4" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{region.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{region.description}</p>
                      </div>
                      {downloaded && (
                        <span className="shrink-0 text-[10px] font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                          Downloaded
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {tileCount} tiles · zoom {region.zooms[0]}-{region.zooms[region.zooms.length - 1]}
                      {saved ? ` · saved ${new Date(saved.downloadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                    </p>
                    {active && (
                      <div className="mt-3">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{progress}% downloaded</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OfflineMaps;
