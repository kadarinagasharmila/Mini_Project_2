import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELANGANA_VIEWBOX = "77.119,15.740,81.728,19.674";
const ROUTE_ALTERNATIVE_COUNT = 12;
const NOMINATIM_HEADERS = {
  "User-Agent": "TSNav/1.0",
  Accept: "application/json",
};

type NominatimPlace = {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
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

type VehicleInfo = {
  transitSummary?: string;
  bikeNote?: string;
  walkNote?: string;
  calories?: number;
};

function getOsrmProfile() {
  // Public OSRM reliably exposes the driving graph, which gives real road-shaped
  // geometry instead of falling back to direct lines for unavailable profiles.
  return "driving";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "geocode") {
      const { address } = body;
      const place = await searchPlace(String(address || ""), 1);

      if (!place) {
        return new Response(JSON.stringify({ error: "Location not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          lat: Number(place.lat),
          lng: Number(place.lon),
          formatted: place.display_name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "autocomplete") {
      const { input } = body;
      const results = await searchPlaces(String(input || ""), 12);
      const predictions = results.map((place) => ({
        description: place.display_name,
        placeId: `${place.lat},${place.lon}`,
      }));

      return new Response(JSON.stringify({ predictions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "place_details") {
      const { placeId } = body;
      const parsed = parseLatLng(String(placeId || ""));

      if (!parsed) {
        return new Response(JSON.stringify({ error: "Place not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          lat: parsed.lat,
          lng: parsed.lng,
          name: "Selected place",
          formatted: `${parsed.lat}, ${parsed.lng}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "weather") {
      const { lat, lng } = body;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,visibility&timezone=Asia/Kolkata`;
      const res = await fetch(url);
      const data = (await res.json()) as OsrmResponse;
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
      const weather = {
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

      return new Response(JSON.stringify({ weather }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "directions") {
      const { origin, destination, mode, avoidTolls } = body;
      const profile = getOsrmProfile();
      const url = `https://router.project-osrm.org/route/v1/${profile}/${origin[1]},${origin[0]};${destination[1]},${destination[0]}?alternatives=${ROUTE_ALTERNATIVE_COUNT}&overview=full&geometries=geojson&steps=true`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        return new Response(JSON.stringify({ error: "No routes found", status: data.code }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const routes = data.routes.map((route, idx) => {
        const leg = route.legs?.[0];
        const durationMin = Math.max(1, Math.round(route.duration / 60));
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        const geometry = (route.geometry?.coordinates || []).map(
          ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
        );

        const steps = (leg?.steps || []).map((step) => ({
          instruction: buildInstruction(step),
          distance: formatDistance(step.distance),
          duration: formatDuration(step.duration),
          icon: getStepIcon(step.maneuver?.modifier || step.maneuver?.type || "straight"),
          travelMode: mode,
        }));

        const traffic = getEstimatedTraffic(idx, durationMin);
        const vehicleInfo: VehicleInfo = {};

        if (mode === "bus") {
          vehicleInfo.transitSummary = "Bus mode is road-based here, not live TSRTC transit routing.";
        }
        if (mode === "bike") {
          vehicleInfo.bikeNote = "Two-wheeler estimate based on road routing. Check road surface locally.";
        }
        if (mode === "walk") {
          vehicleInfo.walkNote = "Walking route based on pedestrian-friendly path estimates.";
          vehicleInfo.calories = Math.round(distanceKm * 65);
        }

        return {
          distance: distanceKm,
          duration: durationMin,
          geometry,
          steps:
            steps.length > 0
              ? steps
              : [
                  {
                    instruction: "Head toward destination",
                    distance: `${distanceKm} km`,
                    duration: `${durationMin} min`,
                    icon: "↑",
                    travelMode: mode,
                  },
                ],
          toll: avoidTolls ? "Toll avoidance limited" : "Not available",
          trafficLevel: traffic.label,
          trafficColor: traffic.color,
          vehicleType: mode || "car",
          summary: getRouteSummary(idx, durationMin, distanceKm),
          vehicleInfo,
          warnings: [],
        };
      });

      return new Response(JSON.stringify({ routes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-maps error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getRouteSummary(index: number, durationMin: number, distanceKm: number) {
  if (index === 0) return "Recommended";
  if (index === 1) return "Fast alternate";
  if (index === 2) return "Scenic alternate";
  return `Route ${index + 1} · ${distanceKm} km · ${durationMin} min`;
}

async function searchPlace(query: string, limit: number): Promise<NominatimPlace | null> {
  const results = await searchPlaces(query, limit);
  return results[0] || null;
}

async function searchPlaces(query: string, limit: number): Promise<NominatimPlace[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const scopedQuery = /telangana|hyderabad|india/i.test(trimmedQuery)
    ? trimmedQuery
    : `${trimmedQuery}, Telangana, India`;

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(scopedQuery)}&limit=${limit}&countrycodes=in&viewbox=${encodeURIComponent(TELANGANA_VIEWBOX)}&bounded=0&addressdetails=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  const data = await res.json();

  return Array.isArray(data) ? data : [];
}

function parseLatLng(value: string): { lat: number; lng: number } | null {
  const [latStr, lngStr] = value.split(",");
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
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

function toTitleCase(text: string): string {
  return text
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function getEstimatedTraffic(index: number, durationMin: number) {
  if (index === 0) return { label: durationMin > 45 ? "Moderate traffic" : "Light traffic", color: "text-traffic-moderate" };
  if (index === 1) return { label: "Heavy traffic", color: "text-traffic-heavy" };
  return { label: "Alternate route", color: "text-traffic-free" };
}

function getDrivingWarning(code: number, windSpeed?: number, visibility?: number): string | null {
  const warnings: string[] = [];
  if ([61, 63, 65, 80, 81, 82].includes(code)) warnings.push("Wet roads - drive carefully, reduce speed");
  if ([95, 96, 99].includes(code)) warnings.push("Thunderstorm - avoid travel if possible");
  if ([45, 48].includes(code)) warnings.push("Low visibility - use fog lights");
  if (visibility && visibility < 2000) warnings.push("Very low visibility - extra caution needed");
  if (windSpeed && windSpeed > 40) warnings.push("Strong winds - two-wheelers be cautious");
  return warnings.length > 0 ? warnings.join(". ") : null;
}

function getStepIcon(maneuver: string): string {
  const icons: Record<string, string> = {
    right: "→",
    left: "←",
    "sharp right": "↗",
    "sharp left": "↙",
    "slight right": "↗",
    "slight left": "↙",
    straight: "↑",
    merge: "↑",
    roundabout: "⟳",
    fork: "↗",
    ramp: "↗",
    uturn: "↩",
    "uturn-right": "↩",
    "uturn-left": "↩",
    arrive: "📍",
    depart: "↑",
  };

  return icons[maneuver] || "↑";
}
