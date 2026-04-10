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

// Geocode using Google Maps API via edge function
export async function geocodeLocation(name: string): Promise<[number, number] | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-maps", {
      body: { action: "geocode", address: name },
    });
    if (error || !data?.lat) return null;
    return [data.lat, data.lng];
  } catch {
    return null;
  }
}

// Places autocomplete via edge function
export async function getPlaceAutocomplete(input: string): Promise<PlacePrediction[]> {
  if (input.length < 2) return [];
  try {
    const { data, error } = await supabase.functions.invoke("google-maps", {
      body: { action: "autocomplete", input },
    });
    if (error || !data?.predictions) return [];
    return data.predictions;
  } catch {
    return [];
  }
}

// Get place coordinates from placeId
export async function getPlaceDetails(placeId: string): Promise<{ lat: number; lng: number; name: string; formatted: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-maps", {
      body: { action: "place_details", placeId },
    });
    if (error || !data?.lat) return null;
    return data;
  } catch {
    return null;
  }
}

// Get weather for a location
export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-maps", {
      body: { action: "weather", lat, lng },
    });
    if (error || !data?.weather) return null;
    return data.weather;
  } catch {
    return null;
  }
}

// Get routes using Google Directions API via edge function
export async function getRoute(
  start: [number, number],
  end: [number, number],
  vehicle: string = "car",
  avoidTolls: boolean = false
): Promise<RouteResult[]> {
  try {
    const { data, error } = await supabase.functions.invoke("google-maps", {
      body: { action: "directions", origin: start, destination: end, mode: vehicle, avoidTolls },
    });

    if (error) throw new Error(error.message || "Directions API error");
    if (!data?.routes?.length) throw new Error("No routes found");

    return data.routes.slice(0, 3) as RouteResult[];
  } catch (error) {
    console.error("Google Directions error:", error);
    throw error;
  }
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

export function getOptimalDeparture(distanceKm: number): string {
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
