import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { routeInfo, location } = await req.json();
    const aiGatewayApiKey = Deno.env.get("AI_GATEWAY_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY");
    const aiGatewayUrl = Deno.env.get("AI_GATEWAY_URL") ?? "https://ai.gateway.lovable.dev/v1/chat/completions";
    if (!aiGatewayApiKey) throw new Error("AI gateway API key is not configured");

    const now = new Date();
    const hour = now.getHours();
    const day = now.toLocaleDateString("en-US", { weekday: "long" });
    const vehicle = routeInfo?.vehicle || "car";

    const vehicleContext: Record<string, string> = {
      car: "The user is driving a car. Consider toll roads, fuel costs, parking at destination, and car-specific traffic patterns.",
      bike: "The user is riding a motorcycle/bike. Consider lane splitting possibilities, road surface quality, two-wheeler specific hazards like potholes, and areas with heavy two-wheeler traffic. Bikes are less affected by car traffic jams.",
      bus: "The user is taking a public bus (TSRTC/city bus). Consider bus stop locations, frequency of buses on this route, typical bus delays, crowding during peak hours, and last bus timings. Bus routes are fixed and slower due to frequent stops.",
      walk: "The user is walking. Consider pedestrian-friendly paths, shade availability (important in Telangana heat), footpath conditions, safe crossing points, and approximate walking time. Traffic doesn't affect walking speed.",
    };

    const prompt = `You are a Telangana traffic and transport analysis AI. Current time: ${now.toLocaleTimeString("en-IN")} on ${day}.
    
Route: ${routeInfo?.sourceName || "Current location"} to ${routeInfo?.destName || "Destination"}
Distance: ${routeInfo?.distance || "unknown"} km
Vehicle type: ${vehicle}
Current hour: ${hour}

${vehicleContext[vehicle] || vehicleContext.car}

Provide a specific, actionable analysis (4-5 sentences) for this ${vehicle} journey covering:
1. Current ${vehicle === "bus" ? "bus service conditions and expected wait times" : vehicle === "bike" ? "road conditions for two-wheelers" : vehicle === "walk" ? "walking conditions and safety" : "traffic conditions"} for this route
2. ${vehicle === "bus" ? "Which bus numbers serve this route and their frequency" : vehicle === "walk" ? "Best walking path and estimated time" : "Best departure time suggestion"}
3. ${vehicle === "bus" ? "Expected crowding level and estimated total journey time including wait" : vehicle === "bike" ? "Road surface and safety alerts for riders" : "Weather or event-related alerts for Telangana today"}
4. One specific ${vehicle}-optimized tip for this route in Telangana

Be specific to Hyderabad/Telangana roads, landmarks, and transport systems. Mention actual road names and areas.`;

    const response = await fetch(aiGatewayUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiGatewayApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `You are a Telangana transport advisor specializing in ${vehicle} travel. Be concise, specific to the region, and give practical advice. Always mention actual Hyderabad landmarks and road names.` },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "Unable to generate analysis.";

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("traffic-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
