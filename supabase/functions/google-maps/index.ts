import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!API_KEY) throw new Error("GOOGLE_MAPS_API_KEY not configured");

    const body = await req.json();
    const { action } = body;

    // --- Geocode a place name ---
    if (action === "geocode") {
      const { address } = body;
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ", Telangana, India")}&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== "OK" || !data.results?.length) {
        return new Response(JSON.stringify({ error: "Location not found", status: data.status }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const loc = data.results[0].geometry.location;
      const formatted = data.results[0].formatted_address;
      return new Response(JSON.stringify({ lat: loc.lat, lng: loc.lng, formatted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Place autocomplete ---
    if (action === "autocomplete") {
      const { input } = body;
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&location=17.385%2C78.4867&radius=150000&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const predictions = (data.predictions || []).map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
      }));
      return new Response(JSON.stringify({ predictions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Place details (get lat/lng from place_id) ---
    if (action === "place_details") {
      const { placeId } = body;
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address,name&key=${API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status !== "OK") {
        return new Response(JSON.stringify({ error: "Place not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const loc = data.result.geometry.location;
      return new Response(JSON.stringify({
        lat: loc.lat, lng: loc.lng,
        name: data.result.name,
        formatted: data.result.formatted_address,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Weather (Open-Meteo, no key needed) ---
    if (action === "weather") {
      const { lat, lng } = body;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,visibility&timezone=Asia/Kolkata`;
      const res = await fetch(url);
      const data = await res.json();
      const current = data.current;

      const weatherCodes: Record<number, string> = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
        55: "Dense drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
        71: "Light snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
        80: "Light showers", 81: "Moderate showers", 82: "Heavy showers",
        85: "Light snow showers", 86: "Heavy snow showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm",
      };

      const weatherEmoji: Record<number, string> = {
        0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️", 45: "🌫️", 48: "🌫️",
        51: "🌦️", 53: "🌧️", 55: "🌧️", 61: "🌧️", 63: "🌧️", 65: "🌧️",
        71: "🌨️", 73: "🌨️", 75: "🌨️", 80: "🌦️", 81: "🌧️", 82: "⛈️",
        95: "⛈️", 96: "⛈️", 99: "⛈️",
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

    // --- Directions (multiple routes) ---
    if (action === "directions") {
      const { origin, destination, mode, avoidTolls } = body;
      const gMode = mode === "bike" ? "bicycling" : mode === "bus" ? "transit" : mode === "walk" ? "walking" : "driving";
      const originStr = `${origin[0]},${origin[1]}`;
      const destStr = `${destination[0]},${destination[1]}`;
      
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&mode=${gMode}&alternatives=true&departure_time=now&traffic_model=best_guess&key=${API_KEY}`;
      
      if (avoidTolls && gMode === "driving") {
        url += "&avoid=tolls";
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== "OK" || !data.routes?.length) {
        return new Response(JSON.stringify({ error: "No routes found", status: data.status }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const routes = data.routes.map((route: any, idx: number) => {
        const leg = route.legs[0];
        const distanceKm = leg.distance.value / 1000;
        const durationMin = Math.round((leg.duration_in_traffic?.value || leg.duration.value) / 60);
        const normalDuration = Math.round(leg.duration.value / 60);

        const geometry = decodePolyline(route.overview_polyline.points);

        const steps = leg.steps.map((step: any) => ({
          instruction: step.html_instructions?.replace(/<[^>]*>/g, "") || "Continue",
          distance: step.distance.text,
          duration: step.duration.text,
          icon: getStepIcon(step.maneuver || "straight"),
          travelMode: step.travel_mode,
          transitDetails: step.transit_details ? {
            lineName: step.transit_details.line?.short_name || step.transit_details.line?.name,
            vehicleType: step.transit_details.line?.vehicle?.type,
            departureStop: step.transit_details.departure_stop?.name,
            arrivalStop: step.transit_details.arrival_stop?.name,
            numStops: step.transit_details.num_stops,
            departureTime: step.transit_details.departure_time?.text,
            arrivalTime: step.transit_details.arrival_time?.text,
            headSign: step.transit_details.headsign,
            color: step.transit_details.line?.color,
          } : undefined,
        }));

        const ratio = durationMin / normalDuration;
        let trafficLevel: string, trafficColor: string;
        if (ratio <= 1.1) { trafficLevel = "Light traffic"; trafficColor = "text-traffic-free"; }
        else if (ratio <= 1.3) { trafficLevel = "Moderate traffic"; trafficColor = "text-traffic-moderate"; }
        else if (ratio <= 1.6) { trafficLevel = "Heavy traffic"; trafficColor = "text-traffic-heavy"; }
        else { trafficLevel = "Severe traffic"; trafficColor = "text-traffic-severe"; }

        const hasToll = route.warnings?.some((w: string) => w.toLowerCase().includes("toll")) ||
                        leg.steps?.some((s: any) => s.html_instructions?.toLowerCase().includes("toll"));
        const toll = hasToll ? `₹${Math.round(distanceKm * 2.5)}` : "Free";

        const summary = route.summary || `Route ${idx + 1}`;

        // Vehicle-specific extras
        const vehicleInfo: Record<string, any> = {};
        if (gMode === "transit") {
          vehicleInfo.transitSummary = steps
            .filter((s: any) => s.transitDetails)
            .map((s: any) => `${s.transitDetails.vehicleType || "Bus"} ${s.transitDetails.lineName || ""} → ${s.transitDetails.arrivalStop || ""}`)
            .join(" | ");
        }
        if (gMode === "bicycling") {
          vehicleInfo.bikeNote = "Two-wheeler route. Watch for potholes and speed breakers.";
        }
        if (gMode === "walking") {
          vehicleInfo.walkNote = `Walking route. Stay hydrated in Telangana heat.`;
          vehicleInfo.calories = Math.round(distanceKm * 65); // ~65 cal/km walking
        }

        return {
          distance: Math.round(distanceKm * 10) / 10,
          duration: durationMin,
          geometry,
          steps,
          toll,
          trafficLevel,
          trafficColor,
          vehicleType: mode || "car",
          summary,
          vehicleInfo,
          warnings: route.warnings || [],
        };
      });

      return new Response(JSON.stringify({ routes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("google-maps error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getDrivingWarning(code: number, windSpeed?: number, visibility?: number): string | null {
  const warnings: string[] = [];
  if ([61, 63, 65, 80, 81, 82].includes(code)) warnings.push("🌧️ Wet roads — drive carefully, reduce speed");
  if ([95, 96, 99].includes(code)) warnings.push("⛈️ Thunderstorm — avoid travel if possible");
  if ([45, 48].includes(code)) warnings.push("🌫️ Low visibility — use fog lights");
  if (visibility && visibility < 2000) warnings.push("⚠️ Very low visibility — extra caution needed");
  if (windSpeed && windSpeed > 40) warnings.push("💨 Strong winds — two-wheelers be cautious");
  return warnings.length > 0 ? warnings.join(". ") : null;
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function getStepIcon(maneuver: string): string {
  const icons: Record<string, string> = {
    "turn-right": "→", "turn-left": "←", "turn-sharp-right": "↗", "turn-sharp-left": "↙",
    "turn-slight-right": "↗", "turn-slight-left": "↙", "straight": "↑", "merge": "↑",
    "roundabout-right": "⟳", "roundabout-left": "⟳", "fork-right": "↗", "fork-left": "↙",
    "ramp-right": "↗", "ramp-left": "↙", "uturn-right": "↩", "uturn-left": "↩",
    "keep-right": "↗", "keep-left": "↙", "ferry": "⛴",
  };
  return icons[maneuver] || "↑";
}
