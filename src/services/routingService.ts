import { supabase } from "@/integrations/supabase/client";

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: [number, number][];
  steps: RouteStep[];
  toll: string;
  trafficLevel: string;
  trafficColor: string;
  vehicleType: string;
  summary?: string;
  vehicleInfo?: {
    transitSummary?: string;
    bikeNote?: string;
    walkNote?: string;
    calories?: number;
  };
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  icon: string;
  travelMode?: string;
  transitDetails?: {
    lineName?: string;
    vehicleType?: string;
    departureStop?: string;
    arrivalStop?: string;
    numStops?: number;
    departureTime?: string;
    arrivalTime?: string;
    headSign?: string;
    color?: string;
  };
}

export interface PlacePrediction {
  description: string;
  placeId: string;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  visibility: number | null;
  condition: string;
  emoji: string;
  code: number;
  isRainy: boolean;
  isStormy: boolean;
  isFoggy: boolean;
  drivingWarning: string | null;
}

export interface HourlyForecastPoint {
  time: string;
  temperature: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  condition: string;
  emoji: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  source: [number, number];
  sourceLabel: string;
  destination: [number, number];
  destLabel: string;
  vehicle: string;
  savedAt: string;
  lastUsedAt?: string;
  timesUsed: number;
}

export interface RoadHazard {
  id: string;
  type: "speedcamera" | "construction" | "pothole" | "accident" | "closure" | "congestion" | "other";
  lat: number;
  lng: number;
  severity: "low" | "medium" | "high";
  description?: string;
}

export interface TrafficIncident {
  id: string;
  type: string;
  description: string | null;
  latitude: number;
  longitude: number;
  severity: "low" | "medium" | "high";
  created_at: string;
  source: "tomtom" | "community" | "sample";
  roadName?: string | null;
  delaySeconds?: number | null;
}

export interface RouteMlPrediction {
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  confidence: number;
  delayMinutes: number;
  topFactors: string[];
  recommendation: string;
}

const INDIA_TIMEZONE = "Asia/Kolkata";
const INDIA_UTC_OFFSET_MINUTES = 330;

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const OSRM_BASE = "https://router.project-osrm.org";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODE_MAPS_CO_BASE = "https://geocode.maps.co/search";
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined;
const TOMTOM_ROUTING_BASE = "https://api.tomtom.com/routing/1/calculateRoute";
const TOMTOM_TRAFFIC_INCIDENTS_URL = "https://api.tomtom.com/traffic/services/5/incidentDetails";
const TELANGANA_BBOX = {
  minLat: 15.74,
  minLng: 77.119,
  maxLat: 19.674,
  maxLng: 81.728,
};

const SAVED_ROUTES_KEY = "telangana_maps_saved_routes";
const ROUTE_CACHE_KEY = "telangana_maps_route_cache";
const OFFLINE_DATA_KEY = "telangana_maps_offline_data";
const MAX_SAVED_ROUTES = 100;
const MAX_CACHED_ROUTES = 50;
const ROUTE_ALTERNATIVE_COUNT = 12;

type NominatimPlace = {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
};

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string | undefined>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OsrmStep = {
  distance: number;
  duration: number;
  name?: string;
  maneuver?: {
    type?: string;
    modifier?: string;
  };
};

type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: {
    coordinates?: [number, number][];
  };
  legs?: Array<{
    steps?: OsrmStep[];
  }>;
};

type OsrmResponse = {
  code?: string;
  routes?: OsrmRoute[];
};

type TomTomInstruction = {
  message?: string;
  street?: string;
  routeOffsetInMeters?: number;
  travelTimeInSeconds?: number;
  lengthInMeters?: number;
  maneuver?: string;
};

type TomTomRoute = {
  summary?: {
    lengthInMeters?: number;
    travelTimeInSeconds?: number;
    trafficDelayInSeconds?: number;
    noTrafficTravelTimeInSeconds?: number;
    departureTime?: string;
    arrivalTime?: string;
  };
  legs?: Array<{
    points?: Array<{
      latitude?: number;
      longitude?: number;
    }>;
  }>;
  guidance?: {
    instructions?: TomTomInstruction[];
  };
};

type TomTomRouteResponse = {
  routes?: TomTomRoute[];
};

type TomTomIncident = {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[] | number[][];
  };
  properties?: {
    id?: string;
    iconCategory?: number;
    magnitudeOfDelay?: number;
    startTime?: string;
    endTime?: string;
    from?: string;
    to?: string;
    length?: number;
    delay?: number;
    roadNumbers?: string[];
    events?: Array<{
      description?: string;
      code?: number;
    }>;
  };
};

type TomTomIncidentResponse = {
  incidents?: TomTomIncident[];
};

type OpenMeteoCurrentResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    visibility?: number;
  };
};

type OpenMeteoHourlyResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    weather_code?: number[];
    wind_speed_10m?: number[];
  };
};

function getOsrmProfile() {
  // The public OSRM demo server reliably exposes the driving graph. Using it for
  // geometry avoids straight fallback lines when bike/walk profiles are unavailable.
  return "driving";
}

async function invokeGoogleMapsFunction<T>(action: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-maps", {
      body: { action, ...body },
    });

    if (error) throw error;
    return data as T;
  } catch {
    // If the Supabase client fails for some reason, attempt a raw function call.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !supabaseKey) return null;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/google-maps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
        },
        body: JSON.stringify({ action, ...body }),
      });
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
}

async function searchPlacesServer(query: string, limit: number): Promise<NominatimPlace[]> {
  const edgeResult = await invokeGoogleMapsFunction<{ predictions: PlacePrediction[] }>("autocomplete", {
    input: query,
  });
  if (!edgeResult?.predictions?.length) return [];

  return edgeResult.predictions
    .map((prediction) => {
      const [lat, lon] = prediction.placeId.split(",");
      if (!lat || !lon) return null;
      return {
        display_name: prediction.description,
        lat: lat.trim(),
        lon: lon.trim(),
      } as NominatimPlace;
    })
    .filter(Boolean) as NominatimPlace[];
}

async function fetchJson<T>(url: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    signal: controller.signal,
  });

  window.clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function searchPlaces(query: string, limit: number): Promise<NominatimPlace[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const scopedQuery = /telangana|india/i.test(trimmedQuery)
    ? trimmedQuery
    : `${trimmedQuery}, Telangana, India`;
  try {
    const serverPlaces = await searchPlacesServer(scopedQuery, limit);
    if (serverPlaces.length > 0) {
      return serverPlaces;
    }
  } catch (err) {
    console.warn("Supabase autocomplete search failed:", err);
  }

  const url = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(scopedQuery)}&limit=${limit}&countrycodes=in&addressdetails=1`;
  try {
    const data = await fetchJson<unknown>(url);
    if (Array.isArray(data) && data.length > 0) {
      return data as NominatimPlace[];
    }
  } catch (err) {
    console.warn("Nominatim search failed:", err);
  }

  try {
    return await mapsCoSearch(scopedQuery, limit);
  } catch (err) {
    console.warn("Maps.co search failed:", err);
  }

  return [];
}

async function mapsCoSearch(query: string, limit: number): Promise<NominatimPlace[]> {
  const url = `${GEOCODE_MAPS_CO_BASE}?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await fetchJson<unknown>(url);
  return Array.isArray(data) ? (data as NominatimPlace[]) : [];
}

// Overpass fallback search for Telangana POIs (villages, temples, attractions)
export async function overpassSearch(query: string, limit = 10): Promise<NominatimPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Telangana approximate bbox: minLat, minLon, maxLat, maxLon
  const minLat = 15.740;
  const minLon = 77.119;
  const maxLat = 19.674;
  const maxLon = 81.728;

  // Build an Overpass QL that searches many common name keys and POI tags inside Telangana bbox
  const safeQuery = trimmed.replace(/"/g, "\\\"");
  const ql = `
  [out:json][timeout:25];
  (
    // direct name matches on common name keys
    node["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    relation["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    node["alt_name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["alt_name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    relation["alt_name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    node["official_name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["official_name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    relation["official_name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    // Telangana villages, hamlets, colonies, mandal towns, and neighbourhoods
    node["place"~"city|town|village|hamlet|locality|suburb|neighbourhood|quarter|municipality|district"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["place"~"city|town|village|hamlet|locality|suburb|neighbourhood|quarter|municipality|district"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    relation["place"~"city|town|village|hamlet|locality|suburb|neighbourhood|quarter|municipality|district"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    node["tourism"~"temple|attraction|viewpoint|museum"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["tourism"~"temple|attraction|viewpoint|museum"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    relation["tourism"~"temple|attraction|viewpoint|museum"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    node["amenity"~"place_of_worship|school|hospital|clinic|college|university|bank|police"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["amenity"~"place_of_worship|school|hospital|clinic|college|university|bank|police"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    node["shop"~".*"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["shop"~".*"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});

    node["historic"~".*"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
    way["historic"~".*"]["name"~"(?i)${safeQuery}"](${minLat},${minLon},${maxLat},${maxLon});
  );
  out center;
`;

  try {
    const resp = await fetch(OVERPASS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `data=${encodeURIComponent(ql)}`,
    });

    if (!resp.ok) return [];
    const data = (await resp.json()) as OverpassResponse;
    if (!data?.elements || !Array.isArray(data.elements)) return [];

    const results: NominatimPlace[] = data.elements.map((el) => {
      const name = (el.tags && (el.tags.name || el.tags['official_name'])) || el.tags?.name || "Unknown";
      const city = el.tags?.["addr:city"] || el.tags?.["is_in:city"] || null;
      const display_name = city ? `${name}, ${city}, Telangana, India` : `${name}, Telangana, India`;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;

      return {
        display_name,
        lat: String(lat),
        lon: String(lon),
        name,
      } as NominatimPlace;
    }).filter(r => r.lat && r.lon);

    // Deduplicate by lat/lon
    const seen = new Set<string>();
    const dedup: NominatimPlace[] = [];
    for (const item of results) {
      const key = `${item.lat},${item.lon}`;
      if (!seen.has(key)) {
        seen.add(key);
        dedup.push(item);
      }
      if (dedup.length >= limit) break;
    }

    return dedup;
  } catch (err) {
    console.warn("Overpass search failed:", err);
    return [];
  }
}

function parseLatLng(value: string): { lat: number; lng: number } | null {
  const [latStr, lngStr] = value.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function toTitleCase(text: string): string {
  return text
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function placeMatchesInput(description: string, input: string): boolean {
  const normalizedDescription = (description || "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const compactDescription = normalizedDescription.replace(/\s+/g, "");

  const tokens = (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  // If user input is empty after normalization, allow the place (UI handles empties elsewhere)
  if (tokens.length === 0) return true;

  // Break the description into words for prefix checks
  const words = normalizedDescription.split(/\s+/).filter(Boolean);

  // Require that every typed token appears in the place description (strong matching)
  // Allow matches either in the spaced description, the compacted form, or as a prefix of any word
  return tokens.every((token) => (
    normalizedDescription.includes(token) ||
    compactDescription.includes(token) ||
    words.some((w) => w.startsWith(token))
  ));
}

// Local Telangana index gives instant suggestions while network autocomplete catches up.
const POPULAR_TELANGANA_PLACES: PlacePrediction[] = [
  { description: "Hyderabad, Telangana", placeId: "17.3850,78.4867" },
  { description: "Secunderabad, Hyderabad", placeId: "17.4399,78.4983" },
  { description: "Charminar, Hyderabad", placeId: "17.3616,78.4746" },
  { description: "HITEC City, Hyderabad", placeId: "17.4474,78.3913" },
  { description: "Gachibowli, Hyderabad", placeId: "17.4401,78.3489" },
  { description: "Madhapur, Hyderabad", placeId: "17.4486,78.3908" },
  { description: "Kukatpally, Hyderabad", placeId: "17.4948,78.3996" },
  { description: "Miyapur, Hyderabad", placeId: "17.4965,78.3578" },
  { description: "LB Nagar, Hyderabad", placeId: "17.3457,78.5522" },
  { description: "Uppal, Hyderabad", placeId: "17.4058,78.5591" },
  { description: "Dilsukhnagar, Hyderabad", placeId: "17.3687,78.5247" },
  { description: "Ameerpet, Hyderabad", placeId: "17.4375,78.4483" },
  { description: "Begumpet, Hyderabad", placeId: "17.4447,78.4664" },
  { description: "Mehdipatnam, Hyderabad", placeId: "17.3958,78.4333" },
  { description: "Jubilee Hills, Hyderabad", placeId: "17.4239,78.4738" },
  { description: "Banjara Hills, Hyderabad", placeId: "17.4126,78.4482" },
  { description: "Kompally, Hyderabad", placeId: "17.5408,78.4824" },
  { description: "Shamshabad, Rangareddy", placeId: "17.2512,78.4377" },
  { description: "Rajiv Gandhi International Airport, Shamshabad", placeId: "17.2403,78.4294" },
  { description: "Golconda Fort, Hyderabad", placeId: "17.3833,78.4011" },
  { description: "Hussain Sagar, Hyderabad", placeId: "17.4239,78.4738" },
  { description: "Warangal, Telangana", placeId: "17.9689,79.5941" },
  { description: "Hanamkonda, Warangal", placeId: "18.0072,79.5584" },
  { description: "Kazipet, Warangal", placeId: "17.9735,79.5030" },
  { description: "Warangal Fort, Warangal", placeId: "17.9859,79.6012" },
  { description: "Thousand Pillar Temple, Hanamkonda", placeId: "18.0037,79.5745" },
  { description: "Karimnagar, Telangana", placeId: "18.4386,79.1288" },
  { description: "Nizamabad, Telangana", placeId: "18.6729,78.0941" },
  { description: "Khammam, Telangana", placeId: "17.2473,80.1514" },
  { description: "Mahbubnagar, Telangana", placeId: "16.7488,78.0035" },
  { description: "Nalgonda, Telangana", placeId: "17.0575,79.2684" },
  { description: "Adilabad, Telangana", placeId: "19.6641,78.5320" },
  { description: "Suryapet, Telangana", placeId: "17.1405,79.6236" },
  { description: "Siddipet, Telangana", placeId: "18.1018,78.8520" },
  { description: "Jagtial, Telangana", placeId: "18.7949,78.9166" },
  { description: "Kamareddy, Telangana", placeId: "18.3205,78.3370" },
  { description: "Mancherial, Telangana", placeId: "18.8756,79.4591" },
  { description: "Ramagundam, Telangana", placeId: "18.8008,79.4521" },
  { description: "Peddapalli, Telangana", placeId: "18.6136,79.3744" },
  { description: "Vikarabad, Telangana", placeId: "17.3381,77.9044" },
  { description: "Sangareddy, Telangana", placeId: "17.6140,78.0816" },
  { description: "Medak, Telangana", placeId: "18.0453,78.2608" },
  { description: "Zaheerabad, Sangareddy", placeId: "17.6814,77.6074" },
  { description: "Bodhan, Nizamabad", placeId: "18.6621,77.8858" },
  { description: "Armoor, Nizamabad", placeId: "18.7895,78.2893" },
  { description: "Kothagudem, Bhadradri Kothagudem", placeId: "17.5515,80.6179" },
  { description: "Bhadrachalam, Bhadradri Kothagudem", placeId: "17.6688,80.8936" },
  { description: "Bhadrachalam Temple, Bhadradri Kothagudem", placeId: "17.6666,80.8889" },
  { description: "Badrachalam, Bhadradri Kothagudem", placeId: "17.6688,80.8936" },
  { description: "Badrachalam Temple, Bhadradri Kothagudem", placeId: "17.6666,80.8889" },
  { description: "Yadadri Temple, Yadadri Bhuvanagiri", placeId: "17.5189,78.8886" },
  { description: "Bhongir Fort, Yadadri Bhuvanagiri", placeId: "17.5151,78.8856" },
  { description: "Basara Saraswathi Temple, Nirmal", placeId: "18.8805,77.9556" },
  { description: "Nirmal, Telangana", placeId: "19.0964,78.3441" },
  { description: "Gadwal, Jogulamba Gadwal", placeId: "16.2350,77.8056" },
  { description: "Wanaparthy, Telangana", placeId: "16.3623,78.0622" },
  { description: "Narayanpet, Telangana", placeId: "16.7472,77.4958" },
  { description: "Jangaon, Telangana", placeId: "17.7260,79.1524" },
  { description: "Mulugu, Telangana", placeId: "18.1910,79.9435" },
  { description: "Medchal, Telangana", placeId: "17.6297,78.4814" },
  { description: "Gajwel, Siddipet", placeId: "17.8495,78.6828" },
  { description: "Huzurabad, Karimnagar", placeId: "18.1994,79.4020" },
  { description: "Siricilla, Rajanna Sircilla", placeId: "18.3866,78.8105" },
  { description: "Vemulawada Temple, Rajanna Sircilla", placeId: "18.4655,78.8687" },
  { description: "Kaleshwaram Temple, Jayashankar Bhupalpally", placeId: "18.8096,79.9067" },
  { description: "Laknavaram Lake, Mulugu", placeId: "18.1558,80.0419" },
  { description: "Nagarjuna Sagar, Nalgonda", placeId: "16.5753,79.3189" },
  { description: "Ramoji Film City, Rangareddy", placeId: "17.2543,78.6808" },
  { description: "Abdullapurmet, Rangareddy", placeId: "local:Abdullapurmet, Rangareddy, Telangana" },
  { description: "Achampet, Nagarkurnool", placeId: "local:Achampet, Nagarkurnool, Telangana" },
  { description: "Alampur, Jogulamba Gadwal", placeId: "local:Alampur, Jogulamba Gadwal, Telangana" },
  { description: "Alladurg, Medak", placeId: "local:Alladurg, Medak, Telangana" },
  { description: "Alwal, Hyderabad", placeId: "local:Alwal, Hyderabad, Telangana" },
  { description: "Amberpet, Hyderabad", placeId: "local:Amberpet, Hyderabad, Telangana" },
  { description: "Amangal, Rangareddy", placeId: "local:Amangal, Rangareddy, Telangana" },
  { description: "Asifabad, Kumuram Bheem Asifabad", placeId: "local:Asifabad, Kumuram Bheem Asifabad, Telangana" },
  { description: "Atmakur, Wanaparthy", placeId: "local:Atmakur, Wanaparthy, Telangana" },
  { description: "Balanagar, Hyderabad", placeId: "local:Balanagar, Hyderabad, Telangana" },
  { description: "Balkonda, Nizamabad", placeId: "local:Balkonda, Nizamabad, Telangana" },
  { description: "Banswada, Kamareddy", placeId: "local:Banswada, Kamareddy, Telangana" },
  { description: "Bellampalli, Mancherial", placeId: "local:Bellampalli, Mancherial, Telangana" },
  { description: "Bhadurpally, Medchal Malkajgiri", placeId: "local:Bhadurpally, Medchal Malkajgiri, Telangana" },
  { description: "Bheemgal, Nizamabad", placeId: "local:Bheemgal, Nizamabad, Telangana" },
  { description: "Bhupalpally, Jayashankar Bhupalpally", placeId: "local:Bhupalpally, Jayashankar Bhupalpally, Telangana" },
  { description: "Bhuvanagiri, Yadadri Bhuvanagiri", placeId: "local:Bhuvanagiri, Yadadri Bhuvanagiri, Telangana" },
  { description: "Bibinagar, Yadadri Bhuvanagiri", placeId: "local:Bibinagar, Yadadri Bhuvanagiri, Telangana" },
  { description: "Boath, Adilabad", placeId: "local:Boath, Adilabad, Telangana" },
  { description: "Bollaram, Sangareddy", placeId: "local:Bollaram, Sangareddy, Telangana" },
  { description: "Chevella, Rangareddy", placeId: "local:Chevella, Rangareddy, Telangana" },
  { description: "Chilkur, Rangareddy", placeId: "local:Chilkur, Rangareddy, Telangana" },
  { description: "Chintal, Hyderabad", placeId: "local:Chintal, Hyderabad, Telangana" },
  { description: "Choutuppal, Yadadri Bhuvanagiri", placeId: "local:Choutuppal, Yadadri Bhuvanagiri, Telangana" },
  { description: "Dammaiguda, Medchal Malkajgiri", placeId: "local:Dammaiguda, Medchal Malkajgiri, Telangana" },
  { description: "Devarakonda, Nalgonda", placeId: "local:Devarakonda, Nalgonda, Telangana" },
  { description: "Dharpally, Nizamabad", placeId: "local:Dharpally, Nizamabad, Telangana" },
  { description: "Dornakal, Mahabubabad", placeId: "local:Dornakal, Mahabubabad, Telangana" },
  { description: "Dubbak, Siddipet", placeId: "local:Dubbak, Siddipet, Telangana" },
  { description: "Dundigal, Medchal Malkajgiri", placeId: "local:Dundigal, Medchal Malkajgiri, Telangana" },
  { description: "Ghanpur, Warangal", placeId: "local:Ghanpur, Warangal, Telangana" },
  { description: "Ghatkesar, Medchal Malkajgiri", placeId: "local:Ghatkesar, Medchal Malkajgiri, Telangana" },
  { description: "Godavarikhani, Peddapalli", placeId: "local:Godavarikhani, Peddapalli, Telangana" },
  { description: "Haliya, Nalgonda", placeId: "local:Haliya, Nalgonda, Telangana" },
  { description: "Hayathnagar, Rangareddy", placeId: "local:Hayathnagar, Rangareddy, Telangana" },
  { description: "Husnabad, Siddipet", placeId: "local:Husnabad, Siddipet, Telangana" },
  { description: "Huzurnagar, Suryapet", placeId: "local:Huzurnagar, Suryapet, Telangana" },
  { description: "Ibrahimpatnam, Rangareddy", placeId: "local:Ibrahimpatnam, Rangareddy, Telangana" },
  { description: "Jadcherla, Mahbubnagar", placeId: "local:Jadcherla, Mahbubnagar, Telangana" },
  { description: "Jammikunta, Karimnagar", placeId: "local:Jammikunta, Karimnagar, Telangana" },
  { description: "Jangoan, Jangaon", placeId: "local:Jangoan, Jangaon, Telangana" },
  { description: "Kagaznagar, Kumuram Bheem Asifabad", placeId: "local:Kagaznagar, Kumuram Bheem Asifabad, Telangana" },
  { description: "Kalwakurthy, Nagarkurnool", placeId: "local:Kalwakurthy, Nagarkurnool, Telangana" },
  { description: "Keesara, Medchal Malkajgiri", placeId: "local:Keesara, Medchal Malkajgiri, Telangana" },
  { description: "Kodad, Suryapet", placeId: "local:Kodad, Suryapet, Telangana" },
  { description: "Kodangal, Vikarabad", placeId: "local:Kodangal, Vikarabad, Telangana" },
  { description: "Kollapur, Nagarkurnool", placeId: "local:Kollapur, Nagarkurnool, Telangana" },
  { description: "Kondapur, Hyderabad", placeId: "local:Kondapur, Hyderabad, Telangana" },
  { description: "Koratla, Jagtial", placeId: "local:Koratla, Jagtial, Telangana" },
  { description: "Kothur, Rangareddy", placeId: "local:Kothur, Rangareddy, Telangana" },
  { description: "Kusumanchi, Khammam", placeId: "local:Kusumanchi, Khammam, Telangana" },
  { description: "Luxettipet, Mancherial", placeId: "local:Luxettipet, Mancherial, Telangana" },
  { description: "Madhira, Khammam", placeId: "local:Madhira, Khammam, Telangana" },
  { description: "Mahabubabad, Telangana", placeId: "local:Mahabubabad, Telangana" },
  { description: "Makthal, Narayanpet", placeId: "local:Makthal, Narayanpet, Telangana" },
  { description: "Malkajgiri, Medchal Malkajgiri", placeId: "local:Malkajgiri, Medchal Malkajgiri, Telangana" },
  { description: "Manikonda, Rangareddy", placeId: "local:Manikonda, Rangareddy, Telangana" },
  { description: "Manthani, Peddapalli", placeId: "local:Manthani, Peddapalli, Telangana" },
  { description: "Maripeda, Mahabubabad", placeId: "local:Maripeda, Mahabubabad, Telangana" },
  { description: "Metpally, Jagtial", placeId: "local:Metpally, Jagtial, Telangana" },
  { description: "Miryalaguda, Nalgonda", placeId: "local:Miryalaguda, Nalgonda, Telangana" },
  { description: "Moinabad, Rangareddy", placeId: "local:Moinabad, Rangareddy, Telangana" },
  { description: "Nakrekal, Nalgonda", placeId: "local:Nakrekal, Nalgonda, Telangana" },
  { description: "Narsampet, Warangal", placeId: "local:Narsampet, Warangal, Telangana" },
  { description: "Narsapur, Medak", placeId: "local:Narsapur, Medak, Telangana" },
  { description: "Nekkonda, Warangal", placeId: "local:Nekkonda, Warangal, Telangana" },
  { description: "Neredmet, Hyderabad", placeId: "local:Neredmet, Hyderabad, Telangana" },
  { description: "Nizampet, Medchal Malkajgiri", placeId: "local:Nizampet, Medchal Malkajgiri, Telangana" },
  { description: "Palakurthy, Jangaon", placeId: "local:Palakurthy, Jangaon, Telangana" },
  { description: "Palwancha, Bhadradri Kothagudem", placeId: "local:Palwancha, Bhadradri Kothagudem, Telangana" },
  { description: "Parkal, Hanamkonda", placeId: "local:Parkal, Hanamkonda, Telangana" },
  { description: "Patancheru, Sangareddy", placeId: "local:Patancheru, Sangareddy, Telangana" },
  { description: "Peerzadiguda, Medchal Malkajgiri", placeId: "local:Peerzadiguda, Medchal Malkajgiri, Telangana" },
  { description: "Pochampally, Yadadri Bhuvanagiri", placeId: "local:Pochampally, Yadadri Bhuvanagiri, Telangana" },
  { description: "Quthbullapur, Medchal Malkajgiri", placeId: "local:Quthbullapur, Medchal Malkajgiri, Telangana" },
  { description: "Rajendranagar, Rangareddy", placeId: "local:Rajendranagar, Rangareddy, Telangana" },
  { description: "Sathupalli, Khammam", placeId: "local:Sathupalli, Khammam, Telangana" },
  { description: "Shadnagar, Rangareddy", placeId: "local:Shadnagar, Rangareddy, Telangana" },
  { description: "Shankarampet, Medak", placeId: "local:Shankarampet, Medak, Telangana" },
  { description: "Shankarpally, Rangareddy", placeId: "local:Shankarpally, Rangareddy, Telangana" },
  { description: "Sirpur, Kumuram Bheem Asifabad", placeId: "local:Sirpur, Kumuram Bheem Asifabad, Telangana" },
  { description: "Tandur, Vikarabad", placeId: "local:Tandur, Vikarabad, Telangana" },
  { description: "Thorrur, Mahabubabad", placeId: "local:Thorrur, Mahabubabad, Telangana" },
  { description: "Toopran, Medak", placeId: "local:Toopran, Medak, Telangana" },
  { description: "Tukkuguda, Rangareddy", placeId: "local:Tukkuguda, Rangareddy, Telangana" },
  { description: "Utnur, Adilabad", placeId: "local:Utnur, Adilabad, Telangana" },
  { description: "Vanasthalipuram, Hyderabad", placeId: "local:Vanasthalipuram, Hyderabad, Telangana" },
  { description: "Wyra, Khammam", placeId: "local:Wyra, Khammam, Telangana" },
  { description: "Yellandu, Bhadradri Kothagudem", placeId: "local:Yellandu, Bhadradri Kothagudem, Telangana" },
  { description: "Yellareddy, Kamareddy", placeId: "local:Yellareddy, Kamareddy, Telangana" },
  { description: "Zaffergadh, Jangaon", placeId: "local:Zaffergadh, Jangaon, Telangana" },
];

export function getInstantTelanganaPlaces(input: string, limit = 8): PlacePrediction[] {
  const matches = POPULAR_TELANGANA_PLACES.filter((place) => placeMatchesInput(place.description, input));
  return matches.slice(0, limit);
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}

function scaleFormattedDuration(value: string, scale: number): string {
  const hourMatch = value.match(/(\d+)\s*h/);
  const minuteMatch = value.match(/(\d+)\s*min/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const totalMinutes = hours * 60 + minutes;

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return value;
  return formatDuration(totalMinutes * 60 * scale);
}

function getStepIcon(maneuver: string): string {
  if (maneuver.includes("left")) return "←";
  if (maneuver.includes("right")) return "→";
  if (maneuver.includes("uturn")) return "↺";
  if (maneuver.includes("roundabout")) return "◌";
  if (maneuver.includes("arrive")) return "📍";
  return "↑";
}

function buildInstruction(step: OsrmStep): string {
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;
  const name = step.name ? ` onto ${step.name}` : "";

  if (type === "arrive") return "Arrive at destination";
  if (type === "depart") return `Start${name}`;
  if (type === "roundabout") return `Take the roundabout${name}`;
  if (type === "end of road") return `Continue at the end of the road${name}`;
  if (modifier) return `${toTitleCase(modifier)}${name}`;
  if (type) return `${toTitleCase(type)}${name}`;

  return step.name ? `Continue on ${step.name}` : "Continue";
}

function getEstimatedTraffic(index: number, durationMin: number) {
  if (index === 0) {
    return {
      label: durationMin > 45 ? "Moderate traffic included" : "Light traffic included",
      color: durationMin > 45 ? "text-traffic-moderate" : "text-traffic-free",
    };
  }

  if (index === 1) {
    return {
      label: durationMin > 60 ? "Heavy traffic included" : "Moderate traffic included",
      color: "text-traffic-heavy",
    };
  }

  return {
    label: "Alternate route",
    color: "text-muted-foreground",
  };
}

function getTrafficMultiplier(analysisTime = new Date()) {
  const parts = getIndiaDateParts(analysisTime);
  const isWeekend = parts.weekday === 0 || parts.weekday === 6;
  const isMorningPeak = !isWeekend && parts.hour >= 8 && parts.hour <= 10;
  const isEveningPeak = !isWeekend && parts.hour >= 17 && parts.hour <= 20;
  const isLunchTraffic = parts.hour >= 13 && parts.hour <= 14;
  const isMonsoon = parts.month >= 6 && parts.month <= 9;
  const event = getCurrentTrafficEvent(analysisTime);

  let multiplier = 1;
  if (isMorningPeak) multiplier += 0.22;
  if (isEveningPeak) multiplier += 0.3;
  if (isWeekend && parts.hour >= 18 && parts.hour <= 21) multiplier += 0.12;
  if (isLunchTraffic) multiplier += 0.08;
  if (isMonsoon) multiplier += 0.07;
  if (event) multiplier += Math.min(0.22, event.penalty / 100);

  return multiplier;
}

function getVehicleAdjustedDurationMin(params: {
  osrmDurationSeconds: number;
  distanceKm: number;
  vehicle: string;
  routeIndex: number;
  analysisTime?: Date;
}) {
  const osrmMinutes = Math.max(1, params.osrmDurationSeconds / 60);
  const trafficMultiplier = getTrafficMultiplier(params.analysisTime);
  const alternatePenalty = params.routeIndex === 0 ? 1 : params.routeIndex === 1 ? 1.08 : 1.14;

  if (params.vehicle === "walk") {
    return Math.max(1, Math.round((params.distanceKm / 4.8) * 60 * alternatePenalty));
  }

  if (params.vehicle === "bike") {
    const twoWheelerMinutes = Math.max((params.distanceKm / 24) * 60, osrmMinutes * 0.72);
    return Math.max(1, Math.round(twoWheelerMinutes * (1 + (trafficMultiplier - 1) * 0.6) * alternatePenalty));
  }

  if (params.vehicle === "bus") {
    const busMinutes = Math.max((params.distanceKm / 18) * 60, osrmMinutes * 1.18) + 6;
    return Math.max(1, Math.round(busMinutes * trafficMultiplier * alternatePenalty));
  }

  return Math.max(1, Math.round(osrmMinutes * trafficMultiplier * alternatePenalty));
}

function getTomTomTravelMode(vehicle: string) {
  if (vehicle === "walk") return "pedestrian";
  if (vehicle === "bike") return "motorcycle";
  if (vehicle === "bus") return "bus";
  return "car";
}

function getTomTomRouteUrl(
  start: [number, number],
  end: [number, number],
  vehicle: string,
  avoidTolls: boolean
) {
  if (!TOMTOM_API_KEY) return null;

  const locations = `${start[0]},${start[1]}:${end[0]},${end[1]}`;
  const params = new URLSearchParams({
    key: TOMTOM_API_KEY,
    traffic: "true",
    travelMode: getTomTomTravelMode(vehicle),
    routeType: "fastest",
    computeTravelTimeFor: "all",
    instructionsType: "text",
    language: "en-US",
    maxAlternatives: "2",
  });

  if (avoidTolls) params.set("avoid", "tollRoads");
  return `${TOMTOM_ROUTING_BASE}/${locations}/json?${params.toString()}`;
}

function getTomTomRouteTraffic(summary: TomTomRoute["summary"], durationMin: number) {
  const delayMin = Math.round((summary?.trafficDelayInSeconds ?? 0) / 60);

  if (delayMin >= 12) {
    return {
      label: `Heavy traffic · ${delayMin} min delay`,
      color: "text-traffic-heavy",
    };
  }

  if (delayMin >= 4 || durationMin > 45) {
    return {
      label: delayMin > 0 ? `Moderate traffic · ${delayMin} min delay` : "Moderate traffic",
      color: "text-traffic-moderate",
    };
  }

  return {
    label: delayMin > 0 ? `Light traffic · ${delayMin} min delay` : "Light traffic",
    color: "text-traffic-free",
  };
}

function mapTomTomRoute(route: TomTomRoute, index: number, vehicle: string, avoidTolls: boolean): RouteResult | null {
  const summary = route.summary;
  const distanceKm = Math.round(((summary?.lengthInMeters ?? 0) / 1000) * 10) / 10;
  const durationMin = Math.max(1, Math.round((summary?.travelTimeInSeconds ?? 0) / 60));
  const points = route.legs?.flatMap((leg) => leg.points || []) || [];
  const geometry = points
    .map((point) => {
      if (typeof point.latitude !== "number" || typeof point.longitude !== "number") return null;
      return [point.latitude, point.longitude] as [number, number];
    })
    .filter(Boolean) as [number, number][];

  if (!distanceKm || !durationMin || geometry.length === 0) return null;

  const instructions = route.guidance?.instructions || [];
  const steps = instructions.length > 0
    ? instructions.map((instruction) => ({
        instruction: instruction.message || instruction.street || "Continue",
        distance: formatDistance(instruction.lengthInMeters ?? 0),
        duration: formatDuration(instruction.travelTimeInSeconds ?? 0),
        icon: getStepIcon(instruction.maneuver || "straight"),
        travelMode: vehicle,
      }))
    : [{
        instruction: "Follow the fastest TomTom route toward destination",
        distance: `${distanceKm} km`,
        duration: `${durationMin} min`,
        icon: "↑",
        travelMode: vehicle,
      }];

  const traffic = getTomTomRouteTraffic(summary, durationMin);
  const vehicleInfo: RouteResult["vehicleInfo"] = {};

  if (vehicle === "bus") {
    vehicleInfo.transitSummary = "TomTom bus estimate uses road traffic, not live public transit schedules.";
  }
  if (vehicle === "bike") {
    vehicleInfo.bikeNote = "TomTom motorcycle routing is used as the closest two-wheeler traffic estimate.";
  }
  if (vehicle === "walk") {
    vehicleInfo.walkNote = "TomTom pedestrian routing is used where pedestrian data is available.";
    vehicleInfo.calories = Math.round(distanceKm * 65);
  }

  return {
    distance: distanceKm,
    duration: durationMin,
    geometry,
    steps,
    toll: avoidTolls ? "Avoiding toll roads where possible" : "Traffic-aware",
    trafficLevel: traffic.label,
    trafficColor: traffic.color,
    vehicleType: vehicle || "car",
    summary: index === 0 ? "TomTom fastest route" : `TomTom alternate ${index + 1}`,
    vehicleInfo,
  };
}

async function getTomTomRoutes(
  start: [number, number],
  end: [number, number],
  vehicle: string,
  avoidTolls: boolean
): Promise<RouteResult[]> {
  const url = getTomTomRouteUrl(start, end, vehicle, avoidTolls);
  if (!url) return [];

  const data = await fetchJson<TomTomRouteResponse>(url, 10000);
  const routes = (data.routes || [])
    .map((route, index) => mapTomTomRoute(route, index, vehicle, avoidTolls))
    .filter(Boolean) as RouteResult[];

  return routes;
}

function getTomTomIncidentType(category?: number) {
  if ([1, 7, 8].includes(category ?? -1)) return "accident";
  if ([9, 10, 11, 14].includes(category ?? -1)) return "construction";
  if ([6].includes(category ?? -1)) return "closure";
  if ([2, 3, 4, 5].includes(category ?? -1)) return "congestion";
  return "other";
}

function getTomTomIncidentSeverity(magnitude?: number): TrafficIncident["severity"] {
  if ((magnitude ?? 0) >= 3) return "high";
  if ((magnitude ?? 0) >= 2) return "medium";
  return "low";
}

function getIncidentPoint(incident: TomTomIncident): [number, number] | null {
  const coordinates = incident.geometry?.coordinates;
  if (!Array.isArray(coordinates)) return null;

  const first = Array.isArray(coordinates[0])
    ? coordinates[0] as number[]
    : coordinates as number[];

  const lng = Number(first[0]);
  const lat = Number(first[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function mapTomTomIncident(incident: TomTomIncident, index: number): TrafficIncident | null {
  const point = getIncidentPoint(incident);
  if (!point) return null;

  const properties = incident.properties || {};
  const eventDescription = properties.events?.map((event) => event.description).filter(Boolean).join(", ");
  const roadName = properties.roadNumbers?.join(", ") || properties.from || properties.to || null;
  const type = getTomTomIncidentType(properties.iconCategory);
  const description = [
    eventDescription || (type === "congestion" ? "Traffic congestion reported" : "Traffic incident reported"),
    roadName ? `near ${roadName}` : "",
  ].filter(Boolean).join(" ");

  return {
    id: `tomtom-${properties.id || index}`,
    type,
    description,
    latitude: point[0],
    longitude: point[1],
    severity: getTomTomIncidentSeverity(properties.magnitudeOfDelay),
    created_at: properties.startTime || new Date().toISOString(),
    source: "tomtom",
    roadName,
    delaySeconds: properties.delay ?? null,
  };
}

function getBboxParam(bbox?: { minLat: number; minLng: number; maxLat: number; maxLng: number }) {
  const box = bbox || TELANGANA_BBOX;
  return `${box.minLng},${box.minLat},${box.maxLng},${box.maxLat}`;
}

async function getTomTomTrafficIncidents(
  bbox?: { minLat: number; minLng: number; maxLat: number; maxLng: number },
  limit = 80
): Promise<TrafficIncident[]> {
  if (!TOMTOM_API_KEY) return [];

  const fields = "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers}}}";
  const params = new URLSearchParams({
    key: TOMTOM_API_KEY,
    bbox: getBboxParam(bbox),
    fields,
    language: "en-US",
  });

  const data = await fetchJson<TomTomIncidentResponse>(`${TOMTOM_TRAFFIC_INCIDENTS_URL}?${params.toString()}`, 10000);
  return (data.incidents || [])
    .map((incident, index) => mapTomTomIncident(incident, index))
    .filter(Boolean)
    .slice(0, limit) as TrafficIncident[];
}

export function generateRouteInsight(params: {
  sourceName?: string;
  destName?: string;
  vehicle: string;
  distanceKm?: number;
  durationMin?: number;
  weather?: WeatherData | null;
  analysisTime?: Date;
}): string {
  const analysisTime = params.analysisTime ?? new Date();
  const hour = getIndiaTimeParts(analysisTime).hour;
  const isRushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
  const routeForContext: RouteResult = {
    distance: params.distanceKm ?? 0,
    duration: params.durationMin ?? 0,
    geometry: [],
    steps: [],
    toll: "",
    trafficLevel: "",
    trafficColor: "",
    vehicleType: params.vehicle,
  };
  const historicalContext = getHistoricalTrafficContext(analysisTime, routeForContext, params.vehicle);
  const vehicleLabel =
    params.vehicle === "bike" ? "two-wheeler" :
    params.vehicle === "bus" ? "bus" :
    params.vehicle === "walk" ? "walk" :
    "drive";
  const timeLabel = analysisTime.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: INDIA_TIMEZONE,
  });

  const parts = [
    `Planned ${vehicleLabel} trip from ${params.sourceName || "your location"} to ${params.destName || "your destination"} based on ${timeLabel} local time in Telangana.`,
  ];

  if (typeof params.durationMin === "number" && typeof params.distanceKm === "number") {
    parts.push(`Estimated travel time is about ${params.durationMin} minutes for ${params.distanceKm.toFixed(1)} km.`);
  }

  if (isRushHour) {
    parts.push("You are traveling during a busy window, so starting 20-30 minutes later may reduce stop-and-go traffic.");
  } else {
    parts.push("Current time looks favorable, with lighter traffic expected than the main peak hours.");
  }

  parts.push(historicalContext.explanation);

  if (params.weather?.drivingWarning) {
    parts.push(`Destination weather is ${params.weather.condition.toLowerCase()} at ${params.weather.temperature}°C with ${params.weather.humidity}% humidity and ${params.weather.windSpeed} km/h wind. ${params.weather.drivingWarning}`);
  } else if (params.weather) {
    parts.push(`Destination weather is ${params.weather.condition.toLowerCase()} at ${params.weather.temperature}°C, feels like ${params.weather.feelsLike}°C, with ${params.weather.humidity}% humidity and ${params.weather.windSpeed} km/h wind.`);
  }

  if (params.vehicle === "bike") {
    parts.push("For bikes, watch for uneven shoulders and potholes on busier inner-city roads.");
  } else if (params.vehicle === "bus") {
    parts.push("Bus mode here is an approximate road estimate, so allow extra buffer for waiting and intermediate stops.");
  } else if (params.vehicle === "walk") {
    parts.push("Walking estimates are best for shorter stretches, and midday heat can make the trip feel longer than the ETA.");
  } else {
    parts.push("Major junctions usually create the biggest delay, so staying on the recommended route is the safer option.");
  }

  return parts.join(" ");
}

export async function generateTrafficAiInsight(params: {
  sourceName?: string;
  destName?: string;
  vehicle: string;
  distanceKm?: number;
  durationMin?: number;
  weather?: WeatherData | null;
  analysisTime?: Date;
}): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("traffic-ai", {
      body: {
        routeInfo: {
          sourceName: params.sourceName,
          destName: params.destName,
          distance: params.distanceKm,
          duration: params.durationMin,
          vehicle: params.vehicle,
          weather: params.weather
            ? `${params.weather.condition}, ${params.weather.temperature}°C`
            : undefined,
        },
      },
    });

    if (error) throw error;
    if (data?.analysis) return String(data.analysis);
  } catch {
    // Fall back to the deterministic local insight when the AI edge function is unavailable.
  }

  return generateRouteInsight(params);
}

type TrafficContext = {
  penalty: number;
  factors: string[];
  explanation: string;
};

const EVENT_TRAFFIC_WINDOWS = [
  {
    name: "Eid al-Adha / Bakrid",
    start: "2026-05-27",
    end: "2026-05-27",
    penalty: 10,
    note: "holiday movement near prayer grounds and market areas",
  },
  {
    name: "Telangana Formation Day",
    start: "2026-06-02",
    end: "2026-06-02",
    penalty: 8,
    note: "public celebrations and local road restrictions may slow traffic",
  },
  {
    name: "Bonalu",
    start: "2026-08-09",
    end: "2026-08-10",
    penalty: 18,
    note: "processions and temple crowds can create heavy city traffic",
  },
  {
    name: "Ganesh Chaturthi",
    start: "2026-09-14",
    end: "2026-09-15",
    penalty: 16,
    note: "festival crowds and pandal routes can increase congestion",
  },
  {
    name: "Bathukamma",
    start: "2026-10-11",
    end: "2026-10-20",
    penalty: 14,
    note: "evening gatherings and cultural events can slow traffic",
  },
  {
    name: "Diwali",
    start: "2026-11-08",
    end: "2026-11-09",
    penalty: 12,
    note: "shopping and celebration travel can increase city congestion",
  },
];

function getHistoricalTrafficContext(analysisTime: Date, route: RouteResult, vehicle: string): TrafficContext {
  const parts = getIndiaDateParts(analysisTime);
  const hour = parts.hour;
  const isWeekend = parts.weekday === 0 || parts.weekday === 6;
  const isMorningPeak = hour >= 8 && hour <= 10;
  const isEveningPeak = hour >= 17 && hour <= 20;
  const isLunchTraffic = hour >= 13 && hour <= 14;
  const isMonsoon = parts.month >= 6 && parts.month <= 9;
  const event = getCurrentTrafficEvent(analysisTime);
  const factors: string[] = [];
  let penalty = 0;

  if (!isWeekend && isMorningPeak) {
    penalty += 20;
    factors.push("Historical morning peak");
  } else if (!isWeekend && isEveningPeak) {
    penalty += 24;
    factors.push("Historical evening peak");
  } else if (isWeekend && (hour >= 11 && hour <= 13 || hour >= 18 && hour <= 21)) {
    penalty += 10;
    factors.push("Weekend movement pattern");
  } else if (isLunchTraffic) {
    penalty += 7;
    factors.push("Lunch-hour traffic pattern");
  }

  if (isMonsoon) {
    penalty += 6;
    factors.push("Monsoon traffic history");
  }

  if (event) {
    penalty += event.penalty;
    factors.push(event.name);
  }

  if (route.distance > 18 && vehicle === "car") {
    penalty += 4;
    factors.push("Long city route");
  }

  const explanation = event
    ? `${event.name} is active around this date, so ${event.note}.`
    : isMorningPeak || isEveningPeak
      ? "Historical traffic data shows this route is usually busy during this time window."
      : "Historical traffic data does not show a major special-event spike right now.";

  return {
    penalty,
    factors,
    explanation,
  };
}

function getCurrentTrafficEvent(analysisTime: Date) {
  const currentKey = getIndiaDateKey(analysisTime);

  return EVENT_TRAFFIC_WINDOWS.find((event) => (
    currentKey >= event.start && currentKey <= event.end
  ));
}

function getIndiaDateKey(date: Date): string {
  const parts = getIndiaDateParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function predictRouteMLRisk(params: {
  route: RouteResult;
  vehicle: string;
  hazards?: RoadHazard[];
  weather?: WeatherData | null;
  analysisTime?: Date;
}): RouteMlPrediction {
  const analysisTime = params.analysisTime ?? new Date();
  const hour = getIndiaTimeParts(analysisTime).hour;
  const hazards = params.hazards ?? [];
  const weather = params.weather;
  const historicalContext = getHistoricalTrafficContext(analysisTime, params.route, params.vehicle);
  const expectedMinutesPerKm =
    params.vehicle === "walk" ? 12 :
    params.vehicle === "bike" ? 4 :
    params.vehicle === "bus" ? 3.2 :
    2.1;
  const actualMinutesPerKm = params.route.distance > 0
    ? params.route.duration / params.route.distance
    : expectedMinutesPerKm;
  const pacePenalty = Math.max(0, actualMinutesPerKm - expectedMinutesPerKm) * 7;
  const severeHazards = hazards.filter((hazard) => hazard.severity === "high").length;
  const moderateHazards = hazards.filter((hazard) => hazard.severity === "medium").length;
  const hazardPenalty = severeHazards * 18 + moderateHazards * 10 + hazards.length * 4;
  const weatherPenalty =
    weather?.isStormy ? 24 :
    weather?.isRainy ? 16 :
    weather?.isFoggy ? 14 :
    (weather?.windSpeed ?? 0) > 30 ? 10 :
    0;
  const rushHourPenalty = ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) ? 18 : 0;
  const vehiclePenalty =
    params.vehicle === "walk" && (weather?.temperature ?? 0) >= 34 ? 12 :
    params.vehicle === "bike" && hazards.some((hazard) => hazard.type === "pothole") ? 10 :
    params.vehicle === "bus" ? 6 :
    0;
  const distancePenalty = Math.min(10, params.route.distance / 8);
  const riskScore = Math.min(
    100,
    Math.round(12 + pacePenalty + hazardPenalty + weatherPenalty + rushHourPenalty + historicalContext.penalty + vehiclePenalty + distancePenalty)
  );
  const riskLevel: RouteMlPrediction["riskLevel"] =
    riskScore >= 70 ? "high" :
    riskScore >= 42 ? "medium" :
    "low";
  const confidence = Math.max(
    62,
    Math.min(94, 72 + Math.min(12, hazards.length * 3) + (weather ? 8 : 0) + (params.route.geometry.length > 8 ? 4 : 0))
  );
  const delayMinutes = Math.max(0, Math.round((riskScore / 100) * Math.max(6, params.route.duration * 0.32)));
  const factors = [
    ...historicalContext.factors,
    rushHourPenalty > 0 && historicalContext.factors.length === 0 ? "Rush-hour traffic pattern" : "",
    hazardPenalty > 0 ? `${hazards.length} route hazard${hazards.length === 1 ? "" : "s"} nearby` : "",
    weatherPenalty > 0 ? weather?.condition || "Weather risk" : "",
    pacePenalty > 10 ? "Slower than normal route pace" : "",
    vehiclePenalty > 0 ? `${toTitleCase(params.vehicle)} sensitivity` : "",
  ].filter(Boolean);
  const topFactors = factors.length ? factors.slice(0, 3) : ["Normal route pace", "No major hazard signals"];

  let recommendation = "ML risk is low. This route looks stable for the selected departure.";
  if (riskLevel === "medium") {
    recommendation = `Traffic risk is moderate. ${historicalContext.explanation} Keep a small buffer before starting.`;
  } else if (riskLevel === "high") {
    recommendation = `Traffic risk is high. ${historicalContext.explanation} Consider a later departure or compare alternate routes before starting.`;
  } else {
    recommendation = `Traffic risk is low. ${historicalContext.explanation}`;
  }

  return {
    riskLevel,
    riskScore,
    confidence,
    delayMinutes,
    topFactors,
    recommendation,
  };
}

export async function geocodeLocation(name: string): Promise<[number, number] | null> {
  const edgeResult = await invokeGoogleMapsFunction<{ lat: number; lng: number }>("geocode", {
    address: name,
  });
  if (edgeResult) return [edgeResult.lat, edgeResult.lng];

  const attempts = [name];
  const normalized = name.trim().toLowerCase();

  if (!normalized.includes("telangana") && !normalized.includes("india")) {
    attempts.push(`${name}, Telangana, India`);
  } else if (!normalized.includes("india")) {
    attempts.push(`${name}, India`);
  }

  for (const address of attempts) {
    try {
      const place = (await searchPlaces(address, 1))[0];
      if (place) return [Number(place.lat), Number(place.lon)];
    } catch {
      // Try the next lookup variant before giving up.
    }
  }

  // As a last resort, try Overpass inside Telangana to find named POIs (villages, temples, attractions)
  try {
    const over = await overpassSearch(name, 3);
    if (over && over.length > 0) {
      const p = over[0];
      return [Number(p.lat), Number(p.lon)];
    }
  } catch {
    // ignore
  }

  return null;
}

export async function getPlaceAutocomplete(input: string): Promise<PlacePrediction[]> {
  if ((input || "").trim().length < 1) return [];
  const instantPlaces = getInstantTelanganaPlaces(input, 8);
  let edgePredictions: PlacePrediction[] = [];

  const edgeResult = await invokeGoogleMapsFunction<{ predictions: PlacePrediction[] }>("autocomplete", {
    input,
  });
  if (edgeResult?.predictions?.length) {
    edgePredictions = edgeResult.predictions
      .filter((prediction) => placeMatchesInput(prediction.description, input))
      .slice(0, 8);

    if (edgePredictions.length >= 8) {
      return mergePlacePredictions(edgePredictions, instantPlaces);
    }
  }

  try {
    const results = await searchPlaces(input, 12);
    const places = mergePlacePredictions(
      edgePredictions,
      results
      .filter((place) => placeMatchesInput(place.display_name, input))
      .map((place) => ({
        description: place.display_name,
        placeId: `${place.lat},${place.lon}`,
      })),
      20
    );

    // If not enough results, try a broader Overpass fallback within Telangana bbox for POIs
    if (places.length < 8) {
      try {
        const extra = await overpassSearch(input, 30);
        const extras = extra
          .filter((place) => placeMatchesInput(place.display_name, input))
          .map((place) => ({ description: place.display_name, placeId: `${place.lat},${place.lon}` }));

        // merge while avoiding duplicates and prefer server results first
        const seen = new Set(places.map((p) => p.placeId));
        for (const e of extras) {
          if (!seen.has(e.placeId)) {
            places.push(e);
            seen.add(e.placeId);
          }
          if (places.length >= 12) break;
        }
      } catch (err) {
        console.warn('Overpass autocomplete fallback failed:', err);
      }
    }

    return mergePlacePredictions(places, instantPlaces);
  } catch {
    return instantPlaces;
  }
}

function mergePlacePredictions(primary: PlacePrediction[], fallback: PlacePrediction[], limit = 10): PlacePrediction[] {
  const seen = new Set<string>();
  const merged: PlacePrediction[] = [];

  for (const place of [...primary, ...fallback]) {
    const key = `${place.placeId}|${place.description.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(place);
    if (merged.length >= limit) break;
  }

  return merged;
}

export async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; name: string; formatted: string } | null> {
  if (String(placeId || "").startsWith("local:")) return null;

  const edgeResult = await invokeGoogleMapsFunction<{ lat: number; lng: number; name: string; formatted: string }>("place_details", {
    placeId,
  });
  if (edgeResult) return edgeResult;

  try {
    const parsed = parseLatLng(String(placeId || ""));
    if (!parsed) return null;
    return {
      lat: parsed.lat,
      lng: parsed.lng,
      name: "Selected place",
      formatted: `${parsed.lat}, ${parsed.lng}`,
    };
  } catch {
    return null;
  }
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  const edgeResult = await invokeGoogleMapsFunction<{ weather: WeatherData }>("weather", {
    lat,
    lng,
  });
  if (edgeResult?.weather) return edgeResult.weather;

  try {
    const data = await fetchJson<OpenMeteoCurrentResponse>(`${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,visibility&timezone=Asia/Kolkata`);
    const current = data.current;

    const weatherCodes: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Light rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Light snow",
      73: "Moderate snow",
      75: "Heavy snow",
      77: "Snow grains",
      80: "Light showers",
      81: "Moderate showers",
      82: "Heavy showers",
      85: "Light snow showers",
      86: "Heavy snow showers",
      95: "Thunderstorm",
      96: "Thunderstorm with hail",
      99: "Severe thunderstorm",
    };

    const weatherEmoji: Record<number, string> = {
      0: "☀️",
      1: "🌤️",
      2: "⛅",
      3: "☁️",
      45: "🌫️",
      48: "🌫️",
      51: "🌦️",
      53: "🌧️",
      55: "🌧️",
      61: "🌧️",
      63: "🌧️",
      65: "🌧️",
      71: "🌨️",
      73: "🌨️",
      75: "🌨️",
      80: "🌦️",
      81: "🌧️",
      82: "⛈️",
      95: "⛈️",
      96: "⛈️",
      99: "⛈️",
    };

    const code = current?.weather_code ?? 0;
    return {
      temperature: current?.temperature_2m,
      feelsLike: current?.apparent_temperature,
      humidity: current?.relative_humidity_2m,
      precipitation: current?.precipitation,
      windSpeed: current?.wind_speed_10m,
      visibility: current?.visibility ? Math.round(current.visibility / 1000) : null,
      condition: weatherCodes[code] || "Unknown",
      emoji: weatherEmoji[code] || "🌡️",
      code,
      isRainy: [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code),
      isStormy: [95, 96, 99].includes(code),
      isFoggy: [45, 48].includes(code),
      drivingWarning: getDrivingWarning(code, current?.wind_speed_10m, current?.visibility),
    };
  } catch {
    return null;
  }
}

export async function getHourlyForecast(lat: number, lng: number): Promise<HourlyForecastPoint[]> {
  try {
    const data = await fetchJson<OpenMeteoHourlyResponse>(
      `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&forecast_days=2&timezone=Asia/Kolkata`
    );

    const hourly = data?.hourly;
    if (!hourly?.time || !Array.isArray(hourly.time)) return [];

    const now = Date.now();
    const points: HourlyForecastPoint[] = hourly.time
      .map((time: string, index: number) => {
        const weatherCode = Number(hourly.weather_code?.[index] ?? 0);
        return {
          time,
          temperature: Number(hourly.temperature_2m?.[index] ?? 0),
          precipitation: Number(hourly.precipitation?.[index] ?? 0),
          windSpeed: Number(hourly.wind_speed_10m?.[index] ?? 0),
          weatherCode,
          condition: getWeatherCondition(weatherCode),
          emoji: getWeatherEmoji(weatherCode),
        };
      })
      .filter((point: HourlyForecastPoint) => new Date(point.time).getTime() >= now)
      .slice(0, 6);

    return points;
  } catch {
    return [];
  }
}

export function buildDepartureOptions(
  durationMin: number | undefined,
  vehicle: string,
  forecast: HourlyForecastPoint[],
  baseTime: Date = new Date()
) {
  const offsets = [0, 30, 60];
  const scores = offsets.map((candidateOffset) => {
    const candidateTime = new Date(baseTime.getTime() + candidateOffset * 60000);
    const candidateForecast = pickNearestForecastPoint(forecast, candidateTime);
    return (isRushHour(candidateTime) ? 2 : 0) + getForecastRisk(candidateForecast);
  });
  const bestScore = Math.min(...scores);

  return offsets.map((offsetMin, index) => {
    const departureTime = new Date(baseTime.getTime() + offsetMin * 60000);
    const nearestForecast = pickNearestForecastPoint(forecast, departureTime);
    const arrivalTime = typeof durationMin === "number"
      ? new Date(departureTime.getTime() + durationMin * 60000)
      : undefined;
    const rushHour = isRushHour(departureTime);
    const weatherRisk = getForecastRisk(nearestForecast);
    const score = (rushHour ? 2 : 0) + weatherRisk;

    let label = "Best balance";
    if (score >= 4) label = "Higher delay risk";
    else if (score >= 2) label = "Okay, but watch traffic";
    else if (score === 0) label = "Best time to leave";

    if (vehicle === "walk" && nearestForecast?.temperature >= 34) {
      label = "Hot for walking";
    }

    return {
      id: `depart-${offsetMin}`,
      offsetMin,
      departureTime,
      arrivalTime,
      forecast: nearestForecast,
      label,
      recommended: score === bestScore && index === scores.indexOf(bestScore),
    };
  });
}

export function getForecastPointForTime(
  forecast: HourlyForecastPoint[],
  target: Date
): HourlyForecastPoint | undefined {
  return pickNearestForecastPoint(forecast, target);
}

export function getForecastSeverity(point?: HourlyForecastPoint): "low" | "medium" | "high" {
  const risk = getForecastRisk(point);
  if (risk >= 3) return "high";
  if (risk >= 1) return "medium";
  return "low";
}

export function getForecastSeverityLabel(point?: HourlyForecastPoint): string {
  const severity = getForecastSeverity(point);
  if (severity === "high") return "Risky conditions";
  if (severity === "medium") return "Use caution";
  return "Good conditions";
}

export function isPastIndiaDateTimeInput(value: string | null | undefined): boolean {
  const parsed = parseIndiaDateTimeInput(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < getIndiaNow().getTime();
}

export function parseIndiaDateTimeInput(value: string | null | undefined): Date | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  ) - INDIA_UTC_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMillis);
}

export function formatIndiaDateTimeInput(value: string | Date | null | undefined): string {
  const date = typeof value === "string" ? parseIndiaDateTimeInput(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "";

  const parts = getIndiaDateParts(date);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function formatIndiaDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? parseIndiaDateTimeInput(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: INDIA_TIMEZONE,
    ...options,
  });
}

export function getIndiaNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function getIndiaPresetDateTime(preset: "now" | "plus30" | "tonight20" | "tomorrow08"): string {
  const now = getIndiaNow();

  if (preset === "now") {
    const rounded = new Date(now.getTime());
    const minutes = rounded.getMinutes();
    const nextFive = Math.ceil(minutes / 5) * 5;
    rounded.setMinutes(nextFive, 0, 0);
    return formatIndiaDateTimeInput(rounded);
  }

  if (preset === "plus30") {
    return formatIndiaDateTimeInput(new Date(now.getTime() + 30 * 60 * 1000));
  }

  const parts = getIndiaDateParts(now);
  const midnightUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0) - INDIA_UTC_OFFSET_MINUTES * 60 * 1000;

  if (preset === "tonight20") {
    const tonight = new Date(midnightUtc + 20 * 60 * 60 * 1000);
    if (now.getTime() > tonight.getTime()) {
      tonight.setTime(tonight.getTime() + 24 * 60 * 60 * 1000);
    }
    return formatIndiaDateTimeInput(tonight);
  }

  const tomorrowMorning = new Date(midnightUtc + (24 + 8) * 60 * 60 * 1000);
  return formatIndiaDateTimeInput(tomorrowMorning);
}

export async function getRoute(
  start: [number, number],
  end: [number, number],
  vehicle: string = "car",
  avoidTolls: boolean = false
): Promise<RouteResult[]> {
  // Try cached route first if offline
  const cached = getCachedRoute(start, end, vehicle);
  if (cached && !navigator.onLine) {
    return [cached];
  }

  try {
    const tomTomRoutes = await getTomTomRoutes(start, end, vehicle, avoidTolls);
    if (tomTomRoutes.length > 0) {
      cacheRoute(tomTomRoutes[0], start, end, vehicle);
      return tomTomRoutes;
    }
  } catch (error) {
    console.warn("TomTom routing failed, falling back:", error);
  }

  const edgeResult = await invokeGoogleMapsFunction<{ routes: RouteResult[] }>("directions", {
    origin: start,
    destination: end,
    mode: vehicle,
    avoidTolls,
  });
  if (edgeResult?.routes?.length) {
    const routes = edgeResult.routes.map((route, index) => {
      const adjustedDuration = getVehicleAdjustedDurationMin({
        osrmDurationSeconds: route.duration * 60,
        distanceKm: route.distance,
        vehicle,
        routeIndex: index,
      });
      const stepDurationScale = route.duration > 0 ? adjustedDuration / route.duration : 1;
      const traffic = getEstimatedTraffic(index, adjustedDuration);

      return {
        ...route,
        duration: adjustedDuration,
        steps: route.steps.map((step) => ({
          ...step,
          duration: scaleFormattedDuration(step.duration, stepDurationScale),
        })),
        toll: avoidTolls ? "Toll avoidance limited" : route.toll,
        trafficLevel: traffic.label,
        trafficColor: traffic.color,
        summary: getRouteSummary(index, adjustedDuration, route.distance),
      };
    });
    cacheRoute(routes[0], start, end, vehicle);
    return routes;
  }

  try {
    const profile = getOsrmProfile();
    const url = `${OSRM_BASE}/route/v1/${profile}/${start[1]},${start[0]};${end[1]},${end[0]}?alternatives=${ROUTE_ALTERNATIVE_COUNT}&overview=full&geometries=geojson&steps=true`;
    const data = await fetchJson<OsrmResponse>(url);

    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error("No routes found");
    }

    return data.routes.map((route, index) => {
      const leg = route.legs?.[0];
      const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
      const durationMin = getVehicleAdjustedDurationMin({
        osrmDurationSeconds: route.duration,
        distanceKm,
        vehicle,
        routeIndex: index,
      });
      const stepDurationScale = route.duration > 0 ? (durationMin * 60) / route.duration : 1;
      const geometry = (route.geometry?.coordinates || []).map(
        ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
      );

      const steps = (leg?.steps || []).map((step) => ({
        instruction: buildInstruction(step),
        distance: formatDistance(step.distance),
        duration: formatDuration(step.duration * stepDurationScale),
        icon: getStepIcon(step.maneuver?.modifier || step.maneuver?.type || "straight"),
        travelMode: vehicle,
      }));

      const traffic = getEstimatedTraffic(index, durationMin);
      const vehicleInfo: RouteResult["vehicleInfo"] = {};

      if (vehicle === "bus") {
        vehicleInfo.transitSummary = "Bus mode is road-based here, not live TSRTC transit routing.";
      }
      if (vehicle === "bike") {
        vehicleInfo.bikeNote = "Bike routing uses road estimates. Double-check road surface and shoulder width locally.";
      }
      if (vehicle === "walk") {
        vehicleInfo.walkNote = "Walking route is estimated from pedestrian-friendly paths.";
        vehicleInfo.calories = Math.round(distanceKm * 65);
      }

      const routeResult = {
        distance: distanceKm,
        duration: durationMin,
        geometry,
        steps: steps.length > 0 ? steps : [{
          instruction: "Head toward destination",
          distance: `${distanceKm} km`,
          duration: `${durationMin} min`,
          icon: "↑",
          travelMode: vehicle,
        }],
        toll: avoidTolls ? "Toll avoidance limited" : "Not available",
        trafficLevel: traffic.label,
        trafficColor: traffic.color,
        vehicleType: vehicle || "car",
        summary: getRouteSummary(index, durationMin, distanceKm),
        vehicleInfo,
      };
      
      // Cache the first route for offline access
      if (index === 0) {
        cacheRoute(routeResult, start, end, vehicle);
      }
      
      return routeResult;
    });
  } catch (error) {
    console.error("Routing error:", error);
    // Try to return cached route as fallback
    const fallback = getCachedRoute(start, end, vehicle);
    return fallback ? [fallback] : [buildFallbackRoute(start, end, vehicle)];
  }
}

function getRouteSummary(index: number, durationMin: number, distanceKm: number) {
  if (index === 0) return "Recommended";
  if (index === 1) return "Fast alternate";
  if (index === 2) return "Scenic alternate";
  return `Route ${index + 1} · ${distanceKm} km · ${durationMin} min`;
}

function buildFallbackRoute(
  start: [number, number],
  end: [number, number],
  vehicle: string
): RouteResult {
  const distanceKm = getGreatCircleDistanceKm(start, end);
  const averageSpeedKmh =
    vehicle === "walk" ? 4.8 :
    vehicle === "bike" ? 18 :
    vehicle === "bus" ? 22 :
    32;
  const durationMin = Math.max(1, Math.round((distanceKm / averageSpeedKmh) * 60));
  const latDelta = end[0] - start[0];
  const lngDelta = end[1] - start[1];
  const bend = Math.min(0.08, Math.max(0.015, distanceKm / 900));
  const bendLat = lngDelta >= 0 ? bend : -bend;
  const bendLng = latDelta >= 0 ? -bend : bend;
  const waypointA: [number, number] = [
    Number((start[0] + latDelta * 0.33 + bendLat).toFixed(6)),
    Number((start[1] + lngDelta * 0.33 + bendLng).toFixed(6)),
  ];
  const waypointB: [number, number] = [
    Number((start[0] + latDelta * 0.66 + bendLat * 0.5).toFixed(6)),
    Number((start[1] + lngDelta * 0.66 + bendLng * 0.5).toFixed(6)),
  ];

  return {
    distance: Math.round(distanceKm * 10) / 10,
    duration: durationMin,
    geometry: [start, waypointA, waypointB, end],
    steps: [
      {
        instruction: "Head toward the destination using the most direct main roads available.",
        distance: `${Math.round(distanceKm * 10) / 10} km`,
        duration: `${durationMin} min`,
        icon: "↑",
        travelMode: vehicle,
      },
      {
        instruction: "Continue toward your destination and follow local road signs.",
        distance: `${Math.max(0.2, Math.round((distanceKm / 2) * 10) / 10)} km`,
        duration: `${Math.max(1, Math.round(durationMin / 2))} min`,
        icon: "→",
        travelMode: vehicle,
      },
      {
        instruction: "Arrive at destination",
        distance: "0 m",
        duration: "0 min",
        icon: "📍",
        travelMode: vehicle,
      },
    ],
    toll: "Not available",
    trafficLevel: "Estimated route",
    trafficColor: "text-muted-foreground",
    vehicleType: vehicle || "car",
    summary: "Estimated direct route",
    vehicleInfo: vehicle === "walk"
      ? { walkNote: "Live route service was unavailable, so this is a straight-line walking estimate." }
      : vehicle === "bike"
        ? { bikeNote: "Live route service was unavailable, so this is a straight-line bike estimate." }
        : vehicle === "bus"
          ? { transitSummary: "Live route service was unavailable, so this is a road-based bus estimate." }
          : undefined,
  };
}

function getGreatCircleDistanceKm(start: [number, number], end: [number, number]) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDiff = toRadians(end[0] - start[0]);
  const lngDiff = toRadians(end[1] - start[1]);
  const lat1 = toRadians(start[0]);
  const lat2 = toRadians(end[0]);

  const haversine =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDiff / 2) ** 2;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

// Get user's current GPS position
export function getUserLocation(): Promise<[number, number]> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  });
}

export async function getLiveTrafficIncidents(options?: {
  bbox?: { minLat: number; minLng: number; maxLat: number; maxLng: number };
  includeCommunity?: boolean;
  limit?: number;
}): Promise<TrafficIncident[]> {
  const includeCommunity = options?.includeCommunity ?? true;
  const limit = options?.limit ?? 100;
  const sources: Array<Promise<TrafficIncident[]>> = [
    getTomTomTrafficIncidents(options?.bbox, limit).catch((error) => {
      console.warn("TomTom incidents failed:", error);
      return [];
    }),
  ];

  if (includeCommunity) {
    sources.push(
      supabase
        .from("traffic_incidents")
        .select("id,type,description,latitude,longitude,severity,created_at")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) throw error;
          return (data || []).map((incident) => ({
            id: `community-${incident.id}`,
            type: incident.type || "other",
            description: incident.description,
            latitude: incident.latitude,
            longitude: incident.longitude,
            severity: incident.severity === "high" || incident.severity === "low" ? incident.severity : "medium",
            created_at: incident.created_at,
            source: "community" as const,
            roadName: null,
            delaySeconds: null,
          }));
        })
        .catch((error) => {
          console.warn("Community incidents failed:", error);
          return [];
        })
    );
  }

  const severityScore = { high: 3, medium: 2, low: 1 };
  return (await Promise.all(sources))
    .flat()
    .sort((a, b) => {
      const severityDelta = severityScore[b.severity] - severityScore[a.severity];
      if (severityDelta !== 0) return severityDelta;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);
}

export async function getLiveHazardsNearRoute(geometry: [number, number][]): Promise<RoadHazard[]> {
  if (geometry.length === 0) return [];

  const lats = geometry.map((point) => point[0]);
  const lngs = geometry.map((point) => point[1]);
  const padding = 0.04;
  const incidents = await getLiveTrafficIncidents({
    bbox: {
      minLat: Math.min(...lats) - padding,
      minLng: Math.min(...lngs) - padding,
      maxLat: Math.max(...lats) + padding,
      maxLng: Math.max(...lngs) + padding,
    },
    limit: 12,
  });

  return incidents.map((incident) => ({
    id: incident.id,
    type: (
      incident.type === "accident" ||
      incident.type === "construction" ||
      incident.type === "closure" ||
      incident.type === "congestion"
        ? incident.type
        : "other"
    ) as RoadHazard["type"],
    lat: incident.latitude,
    lng: incident.longitude,
    severity: incident.severity,
    description: [
      incident.description || "Traffic incident reported",
      incident.source === "tomtom" ? "TomTom live traffic" : "Community report",
      incident.delaySeconds ? `${Math.round(incident.delaySeconds / 60)} min delay` : "",
    ].filter(Boolean).join(" · "),
  }));
}

export function getOptimalDeparture(distanceKm: number): string {
  void distanceKm;
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return "Current time is good — light weekend traffic expected";
  if (hour >= 7 && hour <= 9) return "Consider departing after 10:00 AM to avoid morning rush";
  if (hour >= 16 && hour <= 19) return "Heavy evening traffic now — depart after 8:30 PM for 40% less travel time";
  if (hour >= 10 && hour <= 16) return "Good time to travel — moderate traffic expected";
  return "Low traffic expected at this hour — good time to depart";
}

function getDrivingWarning(code: number, windSpeed?: number, visibility?: number): string | null {
  if ([95, 96, 99].includes(code)) return "Thunderstorm conditions may reduce visibility and slow traffic.";
  if ([61, 63, 65, 80, 81, 82].includes(code)) return "Wet roads are likely. Drive slower and expect a longer braking distance.";
  if ([45, 48].includes(code) || (visibility && visibility < 5000)) return "Low visibility reported. Use headlights and keep extra distance.";
  if (typeof windSpeed === "number" && windSpeed > 35) return "Strong winds are expected. Maintain steady speed and caution near open stretches.";
  return null;
}

function getWeatherCondition(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Light showers",
    81: "Moderate showers",
    82: "Heavy showers",
    85: "Light snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm",
  };

  return weatherCodes[code] || "Unknown";
}

function getWeatherEmoji(code: number): string {
  const weatherEmoji: Record<number, string> = {
    0: "☀️",
    1: "🌤️",
    2: "⛅",
    3: "☁️",
    45: "🌫️",
    48: "🌫️",
    51: "🌦️",
    53: "🌧️",
    55: "🌧️",
    61: "🌧️",
    63: "🌧️",
    65: "🌧️",
    71: "🌨️",
    73: "🌨️",
    75: "🌨️",
    80: "🌦️",
    81: "🌧️",
    82: "⛈️",
    95: "⛈️",
    96: "⛈️",
    99: "⛈️",
  };

  return weatherEmoji[code] || "🌡️";
}

function pickNearestForecastPoint(points: HourlyForecastPoint[], target: Date) {
  if (!points.length) return undefined;

  return points.reduce((closest, point) => {
    const currentDiff = Math.abs(new Date(point.time).getTime() - target.getTime());
    const closestDiff = Math.abs(new Date(closest.time).getTime() - target.getTime());
    return currentDiff < closestDiff ? point : closest;
  });
}

function isRushHour(value: Date) {
  const hour = getIndiaTimeParts(value).hour;
  return (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);
}

function getForecastRisk(point?: HourlyForecastPoint) {
  if (!point) return 1;
  if ([95, 96, 99].includes(point.weatherCode)) return 3;
  if (point.precipitation >= 2 || point.windSpeed >= 30) return 2;
  if (point.precipitation > 0 || point.windSpeed >= 20 || [45, 48].includes(point.weatherCode)) return 1;
  return 0;
}

function getIndiaTimeParts(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(value);
  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
  };
}

function getIndiaDateParts(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0");
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0");
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0");

  return {
    year,
    month,
    day,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

// Saved Routes Management
export function getSavedRoutes(): SavedRoute[] {
  try {
    const data = localStorage.getItem(SAVED_ROUTES_KEY);
    const parsed = data ? JSON.parse(data) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((route): route is SavedRoute => Boolean(route?.id && route?.source && route?.destination))
      .sort((a, b) => {
        const aTime = new Date(a.lastUsedAt || a.savedAt || 0).getTime();
        const bTime = new Date(b.lastUsedAt || b.savedAt || 0).getTime();
        return bTime - aTime;
      });
  } catch {
    return [];
  }
}

export function saveRoute(route: Omit<SavedRoute, "id" | "savedAt" | "timesUsed">): SavedRoute {
  const saved = getSavedRoutes();
  const id = `${route.source.join(",")}−${route.destination.join(",")}−${route.vehicle}`;
  const existingIndex = saved.findIndex(r => r.id === id);
  const now = new Date().toISOString();
  
  const newRoute: SavedRoute = {
    ...route,
    id,
    savedAt: existingIndex >= 0 ? saved[existingIndex].savedAt : now,
    lastUsedAt: now,
    timesUsed: existingIndex >= 0 ? saved[existingIndex].timesUsed + 1 : 1,
  };
  
  if (existingIndex >= 0) {
    saved[existingIndex] = newRoute;
  } else {
    saved.unshift(newRoute);
  }
  
  localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(saved.slice(0, MAX_SAVED_ROUTES)));
  return newRoute;
}

export function deleteSavedRoute(id: string): void {
  const saved = getSavedRoutes();
  localStorage.setItem(SAVED_ROUTES_KEY, JSON.stringify(saved.filter(r => r.id !== id)));
}

// Offline Route Caching
export function cacheRoute(route: RouteResult, source: [number, number], destination: [number, number], vehicle: string): void {
  try {
    const cache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "[]") as Array<{ route: RouteResult; source: [number, number]; destination: [number, number]; vehicle: string; cached: string }>;
    const id = `${source.join(",")}−${destination.join(",")}−${vehicle}`;
    const existing = cache.findIndex(c => `${c.source.join(",")}−${c.destination.join(",")}−${c.vehicle}` === id);
    
    const cacheEntry = { route, source, destination, vehicle, cached: new Date().toISOString() };
    if (existing >= 0) {
      cache[existing] = cacheEntry;
    } else {
      cache.push(cacheEntry);
    }
    
    const latest = cache
      .sort((a, b) => new Date(b.cached).getTime() - new Date(a.cached).getTime())
      .slice(0, MAX_CACHED_ROUTES);
    localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(latest));
  } catch (error) {
    console.warn("Could not cache route:", error);
  }
}

export function getCachedRoute(source: [number, number], destination: [number, number], vehicle: string): RouteResult | null {
  try {
    const cache = JSON.parse(localStorage.getItem(ROUTE_CACHE_KEY) || "[]") as Array<{ route: RouteResult; source: [number, number]; destination: [number, number]; vehicle: string }>;
    const found = cache.find(c => 
      c.source[0] === source[0] && c.source[1] === source[1] &&
      c.destination[0] === destination[0] && c.destination[1] === destination[1] &&
      c.vehicle === vehicle
    );
    return found ? found.route : null;
  } catch {
    return null;
  }
}

// Road Hazards (Simulated)
export function getHazardsNearRoute(geometry: [number, number][]): RoadHazard[] {
  const hazards: RoadHazard[] = [
    { id: "h1", type: "speedcamera", lat: 17.4435, lng: 78.3772, severity: "high", description: "Speed camera near HITEC City" },
    { id: "h2", type: "construction", lat: 17.4374, lng: 78.4482, severity: "medium", description: "Road work on Ameerpet road" },
    { id: "h3", type: "accident", lat: 17.385, lng: 78.4867, severity: "high", description: "Recent accident reported" },
    { id: "h4", type: "pothole", lat: 17.3616, lng: 78.4747, severity: "low", description: "Pothole near destination" },
  ];
  
  return hazards.filter(hazard => {
    for (const point of geometry) {
      const dist = Math.sqrt(Math.pow(hazard.lat - point[0], 2) + Math.pow(hazard.lng - point[1], 2));
      if (dist < 0.05) return true; // Within ~5km
    }
    return false;
  });
}
