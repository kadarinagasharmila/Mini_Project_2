// AI Traffic Prediction Service for Telangana
// Uses historical patterns, time-of-day, day-of-week, and seasonal factors

export interface TrafficPrediction {
  overallLevel: "free" | "moderate" | "heavy" | "severe";
  congestionScore: number; // 0-100
  segments: TrafficSegment[];
  suggestion: string;
  peakHours: string[];
  bestDepartureTime: string;
  weatherImpact: string;
}

export interface TrafficSegment {
  name: string;
  level: "free" | "moderate" | "heavy" | "severe";
  speed: number; // km/h
  delay: number; // minutes
}

// Hyderabad road network with typical congestion patterns
const ROAD_CONGESTION_PROFILES: Record<string, { baseCongestion: number; peakMultiplier: number }> = {
  "ORR": { baseCongestion: 15, peakMultiplier: 1.8 },
  "NH65": { baseCongestion: 30, peakMultiplier: 2.2 },
  "Inner Ring Road": { baseCongestion: 45, peakMultiplier: 2.5 },
  "Jubilee Hills Road": { baseCongestion: 35, peakMultiplier: 2.0 },
  "Madhapur Road": { baseCongestion: 50, peakMultiplier: 2.8 },
  "Ameerpet Junction": { baseCongestion: 60, peakMultiplier: 3.0 },
  "Mehdipatnam": { baseCongestion: 55, peakMultiplier: 2.7 },
  "LB Nagar": { baseCongestion: 40, peakMultiplier: 2.3 },
  "Secunderabad": { baseCongestion: 45, peakMultiplier: 2.4 },
  "Kukatpally": { baseCongestion: 50, peakMultiplier: 2.6 },
  "HITEC City": { baseCongestion: 55, peakMultiplier: 3.0 },
  "Gachibowli": { baseCongestion: 45, peakMultiplier: 2.8 },
  "Miyapur": { baseCongestion: 35, peakMultiplier: 2.1 },
  "Dilsukhnagar": { baseCongestion: 50, peakMultiplier: 2.5 },
  "Charminar": { baseCongestion: 55, peakMultiplier: 2.3 },
};

function getTimeFactor(): { factor: number; period: string } {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeVal = hour + minute / 60;
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    if (timeVal >= 10 && timeVal <= 13) return { factor: 0.5, period: "weekend_midday" };
    if (timeVal >= 17 && timeVal <= 20) return { factor: 0.6, period: "weekend_evening" };
    return { factor: 0.3, period: "weekend_off" };
  }

  // Weekday traffic patterns
  if (timeVal >= 8 && timeVal <= 10.5) return { factor: 0.9, period: "morning_peak" };
  if (timeVal >= 17 && timeVal <= 20) return { factor: 1.0, period: "evening_peak" };
  if (timeVal >= 13 && timeVal <= 14.5) return { factor: 0.6, period: "lunch" };
  if (timeVal >= 10.5 && timeVal <= 17) return { factor: 0.5, period: "midday" };
  if (timeVal >= 6 && timeVal <= 8) return { factor: 0.4, period: "early_morning" };
  return { factor: 0.15, period: "night" };
}

function getWeatherFactor(): { factor: number; description: string } {
  // Simulate weather impact based on season
  const month = new Date().getMonth();
  
  // Monsoon season (June-September)
  if (month >= 5 && month <= 8) {
    return { factor: 1.3, description: "Monsoon season — expect 20-30% longer travel times due to rain" };
  }
  // Summer (March-May)
  if (month >= 2 && month <= 4) {
    return { factor: 1.0, description: "Clear conditions — normal traffic patterns" };
  }
  // Winter (November-February)
  if (month >= 10 || month <= 1) {
    return { factor: 1.05, description: "Mild weather — slight morning fog possible" };
  }
  return { factor: 1.0, description: "Normal weather conditions" };
}

export function predictTrafficForArea(): TrafficPrediction {
  const timeFactor = getTimeFactor();
  const weatherFactor = getWeatherFactor();

  const segments: TrafficSegment[] = Object.entries(ROAD_CONGESTION_PROFILES).map(([name, profile]) => {
    const congestion = Math.min(100, profile.baseCongestion * (1 + timeFactor.factor * (profile.peakMultiplier - 1)) * weatherFactor.factor);
    const speed = Math.max(5, 60 - congestion * 0.5);
    const delay = Math.round(congestion / 10);

    let level: "free" | "moderate" | "heavy" | "severe";
    if (congestion < 25) level = "free";
    else if (congestion < 50) level = "moderate";
    else if (congestion < 75) level = "heavy";
    else level = "severe";

    return { name, level, speed: Math.round(speed), delay };
  });

  const avgCongestion = segments.reduce((sum, s) => sum + (s.level === "free" ? 10 : s.level === "moderate" ? 40 : s.level === "heavy" ? 70 : 90), 0) / segments.length;

  let overallLevel: "free" | "moderate" | "heavy" | "severe";
  if (avgCongestion < 25) overallLevel = "free";
  else if (avgCongestion < 50) overallLevel = "moderate";
  else if (avgCongestion < 75) overallLevel = "heavy";
  else overallLevel = "severe";

  const suggestions: Record<string, string> = {
    morning_peak: "Morning rush hour active. Consider alternate routes through ORR to avoid city center congestion.",
    evening_peak: "Evening peak traffic. HITEC City and Madhapur areas heavily congested. ORR recommended.",
    lunch: "Moderate lunch-hour traffic. Good time for shorter trips.",
    midday: "Moderate traffic levels. Most routes flowing smoothly.",
    early_morning: "Light early morning traffic. Good conditions for travel.",
    night: "Very light traffic. All routes clear.",
    weekend_midday: "Light weekend traffic with some leisure congestion around malls.",
    weekend_evening: "Moderate weekend evening traffic near entertainment areas.",
    weekend_off: "Very light weekend traffic. Excellent time to travel.",
  };

  const peakHours = timeFactor.period.includes("weekend")
    ? ["11:00 AM - 1:00 PM", "6:00 PM - 8:00 PM"]
    : ["8:00 AM - 10:30 AM", "5:00 PM - 8:00 PM"];

  let bestDepartureTime: string;
  const hour = new Date().getHours();
  if (hour < 7) bestDepartureTime = "Now — before 7:00 AM";
  else if (hour < 10) bestDepartureTime = "After 10:30 AM";
  else if (hour < 16) bestDepartureTime = "Now — before 5:00 PM rush";
  else if (hour < 20) bestDepartureTime = "After 8:30 PM";
  else bestDepartureTime = "Now — light traffic expected";

  return {
    overallLevel,
    congestionScore: Math.round(avgCongestion),
    segments,
    suggestion: suggestions[timeFactor.period] || "Normal traffic conditions.",
    peakHours,
    bestDepartureTime,
    weatherImpact: weatherFactor.description,
  };
}

export function getTrafficCounts(): { clear: number; moderate: number; heavy: number; severe: number } {
  const prediction = predictTrafficForArea();
  const counts = { clear: 0, moderate: 0, heavy: 0, severe: 0 };
  
  prediction.segments.forEach((seg) => {
    if (seg.level === "free") counts.clear++;
    else if (seg.level === "moderate") counts.moderate++;
    else if (seg.level === "heavy") counts.heavy++;
    else counts.severe++;
  });

  // Scale up to simulate more road segments
  return {
    clear: counts.clear * 8 + Math.floor(Math.random() * 10),
    moderate: counts.moderate * 5 + Math.floor(Math.random() * 5),
    heavy: counts.heavy * 3 + Math.floor(Math.random() * 3),
    severe: counts.severe * 2 + Math.floor(Math.random() * 2),
  };
}
