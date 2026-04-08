// OSRM public demo server - supports driving, bike (cycling not available on demo), foot
// For bike/bus we use driving with speed adjustments
const OSRM_BASE = "https://router.project-osrm.org/route/v1";

// Telangana locations geocoding database
export const TELANGANA_LOCATIONS: Record<string, [number, number]> = {
  "charminar": [17.3616, 78.4747],
  "hitech city": [17.4435, 78.3772],
  "warangal fort": [17.9551, 79.6011],
  "shamirpet lake": [17.5878, 78.5742],
  "golconda fort": [17.3833, 78.4011],
  "hussain sagar": [17.4239, 78.4738],
  "tankbund": [17.4250, 78.4744],
  "secunderabad": [17.4399, 78.4983],
  "lb nagar": [17.3457, 78.5522],
  "dilsukhnagar": [17.3688, 78.5247],
  "ameerpet": [17.4375, 78.4483],
  "kukatpally": [17.4849, 78.4138],
  "gachibowli": [17.4401, 78.3489],
  "madhapur": [17.4484, 78.3908],
  "banjara hills": [17.4156, 78.4347],
  "jubilee hills": [17.4325, 78.4073],
  "miyapur": [17.4969, 78.3594],
  "begumpet": [17.4432, 78.4672],
  "nampally": [17.3850, 78.4867],
  "mehdipatnam": [17.3950, 78.4424],
  "abids": [17.3924, 78.4754],
  "koti": [17.3876, 78.4839],
  "uppal": [17.4003, 78.5586],
  "ecil": [17.4570, 78.5490],
  "kompally": [17.5439, 78.4834],
  "shamshabad": [17.2473, 78.4263],
  "rajiv gandhi airport": [17.2403, 78.4294],
  "rgia": [17.2403, 78.4294],
  "lingampally": [17.4921, 78.3172],
  "hitec city": [17.4435, 78.3772],
  "kondapur": [17.4574, 78.3637],
  "manikonda": [17.4020, 78.3875],
  "narsingi": [17.3870, 78.3560],
  "tolichowki": [17.3972, 78.4180],
  "srisailam": [16.0841, 78.8682],
  "warangal": [17.9689, 79.5941],
  "karimnagar": [18.4386, 79.1288],
  "nizamabad": [18.6725, 78.0942],
  "khammam": [17.2473, 80.1514],
  "nalgonda": [17.0575, 79.2690],
  "adilabad": [19.6641, 78.5320],
  "mahabubnagar": [16.7488, 77.9855],
  "medak": [18.0531, 78.2639],
  "ranga reddy": [17.3000, 78.4000],
  "hyderabad": [17.385, 78.4867],
};

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: [number, number][];
  steps: RouteStep[];
  toll: string;
  trafficLevel: string;
  trafficColor: string;
  vehicleType: string;
}

export interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
  icon: string;
}

export function geocodeLocation(name: string): [number, number] | null {
  const normalized = name.toLowerCase().trim();
  if (TELANGANA_LOCATIONS[normalized]) return TELANGANA_LOCATIONS[normalized];
  for (const [key, coords] of Object.entries(TELANGANA_LOCATIONS)) {
    if (key.includes(normalized) || normalized.includes(key)) return coords;
  }
  return null;
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

const MANEUVER_ICONS: Record<string, string> = {
  "turn-right": "→", "turn-left": "←", "turn-sharp-right": "↗", "turn-sharp-left": "↙",
  "turn-slight-right": "↗", "turn-slight-left": "↙", "straight": "↑", "depart": "↑",
  "arrive": "📍", "roundabout": "⟳", "rotary": "⟳", "merge": "↑", "fork": "↗",
  "end of road": "→", "continue": "↑", "new name": "↑", "ramp": "↗",
};

// Vehicle speed multipliers relative to car driving speed
const VEHICLE_SPEED_FACTORS: Record<string, number> = {
  car: 1.0,
  bike: 0.5,     // bikes go ~half car speed in city
  bus: 0.65,     // buses are slower due to stops, traffic
  walk: 0.15,    // walking is ~5 km/h vs ~30 km/h car
};

// Vehicle-specific average speeds (km/h) for Telangana roads
const VEHICLE_AVG_SPEEDS: Record<string, number> = {
  car: 28,
  bike: 22,
  bus: 18,
  walk: 5,
};

export async function getRoute(
  start: [number, number],
  end: [number, number],
  vehicle: string = "car"
): Promise<RouteResult[]> {
  // OSRM public demo only supports driving & foot
  // For bike, use driving route with adjusted timings
  // For bus, use driving route with bus-specific adjustments (stops, slower speed)
  const osrmMode = vehicle === "walk" ? "foot" : "driving";

  try {
    const url = `${OSRM_BASE}/${osrmMode === "foot" ? "walking" : "driving"}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=polyline&steps=true&alternatives=3`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`OSRM error: ${response.status}`);

    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route found");

    const speedFactor = VEHICLE_SPEED_FACTORS[vehicle] || 1.0;

    const results: RouteResult[] = data.routes.map((route: any, idx: number) => {
      const distanceKm = route.distance / 1000;
      // Adjust duration based on vehicle type
      let durationMin: number;
      if (vehicle === "walk") {
        // OSRM walking profile gives accurate walk times
        durationMin = Math.round(route.duration / 60);
      } else if (vehicle === "bus") {
        // Bus: driving time + stop time (~2 min per 3 km for bus stops)
        const baseDriving = route.duration / 60;
        const busStops = Math.floor(distanceKm / 3);
        durationMin = Math.round(baseDriving / speedFactor + busStops * 2);
      } else if (vehicle === "bike") {
        // Bike: use average speed calculation
        durationMin = Math.round((distanceKm / VEHICLE_AVG_SPEEDS.bike) * 60);
      } else {
        durationMin = Math.round(route.duration / 60);
      }

      const traffic = predictTraffic(distanceKm, durationMin, vehicle);
      // Apply traffic multiplier to duration
      const adjustedDuration = Math.round(durationMin * traffic.multiplier);

      const geometry = decodePolyline(route.geometry);

      const steps: RouteStep[] = route.legs[0].steps.map((step: any) => {
        const stepDist = step.distance;
        let stepDur: number;
        if (vehicle === "walk") {
          stepDur = step.duration;
        } else {
          stepDur = (stepDist / 1000) / (VEHICLE_AVG_SPEEDS[vehicle] || 28) * 3600;
        }

        return {
          instruction: step.maneuver.instruction || step.name || "Continue",
          distance: stepDist > 1000
            ? `${(stepDist / 1000).toFixed(1)} km`
            : `${Math.round(stepDist)} m`,
          duration: stepDur > 60
            ? `${Math.round(stepDur / 60)} min`
            : `${Math.round(stepDur)} sec`,
          icon: MANEUVER_ICONS[step.maneuver.type] || "↑",
        };
      });

      // Add bus stop info to steps if bus
      if (vehicle === "bus" && steps.length > 2) {
        const busStopCount = Math.floor(distanceKm / 3);
        if (busStopCount > 0) {
          steps.splice(1, 0, {
            instruction: `~${busStopCount} bus stops along this route`,
            distance: "",
            duration: `+${busStopCount * 2} min`,
            icon: "🚏",
          });
        }
      }

      const hasToll = vehicle === "car" && distanceKm > 15;
      const tollCost = hasToll ? Math.round(distanceKm * 2.5) : 0;

      return {
        distance: Math.round(distanceKm * 10) / 10,
        duration: adjustedDuration,
        geometry,
        steps,
        toll: vehicle === "car" && idx === 0 && tollCost > 0 ? `₹${tollCost}` : "Free",
        trafficLevel: traffic.level,
        trafficColor: traffic.color,
        vehicleType: vehicle,
      };
    });

    // If API only returned 1 route, generate alternatives
    if (results.length === 1) {
      const r = results[0];
      results.push(
        { ...r, distance: Math.round(r.distance * 1.15 * 10) / 10, duration: Math.round(r.duration * 1.25), toll: "Free", trafficLevel: "Moderate traffic", trafficColor: "text-traffic-moderate" },
        { ...r, distance: Math.round(r.distance * 1.3 * 10) / 10, duration: Math.round(r.duration * 1.5), toll: "Free", trafficLevel: "Heavy traffic", trafficColor: "text-traffic-heavy" },
      );
    }

    return results.slice(0, 3);
  } catch (error) {
    console.error("Routing error, using fallback:", error);
    return getFallbackRoute(start, end, vehicle);
  }
}

function getFallbackRoute(start: [number, number], end: [number, number], vehicle: string): RouteResult[] {
  const R = 6371;
  const dLat = ((end[0] - start[0]) * Math.PI) / 180;
  const dLon = ((end[1] - start[1]) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((start[0] * Math.PI) / 180) * Math.cos((end[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadDistance = straightLine * (vehicle === "walk" ? 1.2 : 1.4);
  const avgSpeed = VEHICLE_AVG_SPEEDS[vehicle] || 28;
  const duration = Math.round((roadDistance / avgSpeed) * 60);
  const traffic = predictTraffic(roadDistance, duration, vehicle);
  const adjustedDuration = Math.round(duration * traffic.multiplier);

  const midLat = (start[0] + end[0]) / 2;
  const midLng = (start[1] + end[1]) / 2;
  const offset = straightLine * 0.001;

  const vehicleLabel = vehicle === "bus" ? "🚌" : vehicle === "bike" ? "🚲" : vehicle === "walk" ? "🚶" : "🚗";

  const baseRoute: RouteResult = {
    distance: Math.round(roadDistance * 10) / 10,
    duration: adjustedDuration,
    geometry: [start, [midLat + offset, midLng - offset], end],
    steps: [
      { instruction: `${vehicleLabel} Head toward destination`, distance: `${Math.round(roadDistance)} km`, duration: `${adjustedDuration} min`, icon: "↑" },
      { instruction: "Continue on main road", distance: `${Math.round(roadDistance * 0.6)} km`, duration: `${Math.round(adjustedDuration * 0.6)} min`, icon: "↑" },
      { instruction: "Arrive at destination", distance: "", duration: "", icon: "📍" },
    ],
    toll: vehicle === "car" && roadDistance > 15 ? `₹${Math.round(roadDistance * 2.5)}` : "Free",
    trafficLevel: traffic.level,
    trafficColor: traffic.color,
    vehicleType: vehicle,
  };

  return [
    baseRoute,
    { ...baseRoute, geometry: [start, [midLat - offset, midLng + offset], end], distance: Math.round(roadDistance * 1.15 * 10) / 10, duration: Math.round(adjustedDuration * 1.25), toll: "Free", trafficLevel: "Moderate traffic", trafficColor: "text-traffic-moderate" },
    { ...baseRoute, geometry: [start, [midLat + offset * 2, midLng], end], distance: Math.round(roadDistance * 1.3 * 10) / 10, duration: Math.round(adjustedDuration * 1.5), toll: "Free", trafficLevel: "Heavy traffic", trafficColor: "text-traffic-heavy" },
  ];
}

// Vehicle-aware traffic prediction
function predictTraffic(distanceKm: number, baseDuration: number, vehicle: string = "car"): { level: string; color: string; multiplier: number } {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  let multiplier = 1.0;

  if (!isWeekend) {
    if (hour >= 8 && hour <= 10) multiplier = 1.6;
    else if (hour >= 17 && hour <= 20) multiplier = 1.8;
    else if (hour >= 10 && hour <= 17) multiplier = 1.2;
  } else {
    if (hour >= 10 && hour <= 18) multiplier = 1.15;
  }

  // Vehicle-specific adjustments
  if (vehicle === "bike") {
    multiplier *= 0.7; // bikes less affected by car traffic
  } else if (vehicle === "bus") {
    multiplier *= 1.15; // buses more affected due to fixed routes & stops
  } else if (vehicle === "walk") {
    multiplier = 1.0; // walking unaffected by traffic
  }

  if (distanceKm > 20) multiplier *= 1.1;

  if (vehicle === "walk") return { level: "Walking pace", color: "text-traffic-free", multiplier: 1.0 };
  if (multiplier <= 1.1) return { level: "Light traffic", color: "text-traffic-free", multiplier };
  if (multiplier <= 1.35) return { level: "Moderate traffic", color: "text-traffic-moderate", multiplier };
  if (multiplier <= 1.6) return { level: "Heavy traffic", color: "text-traffic-heavy", multiplier };
  return { level: "Severe traffic", color: "text-traffic-severe", multiplier };
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
