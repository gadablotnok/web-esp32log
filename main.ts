import { serveDir } from "std/http/file_server.ts";

interface DataPoint {
  ds: number;
  moisture: number;
  time: string;
}

// In-memory state
let history: DataPoint[] = [];
let latestData: DataPoint = {
  ds: 25.0,
  moisture: 50,
  time: new Date().toISOString(),
};
let config = {
  interval: 2000,
  isLogging: true,
  dryValue: 4095,
  wetValue: 1500,
};

// --- DATA SYNTHESIS GENERATOR ---
// Generates dummy data on-demand instead of background setInterval
// This is much safer for serverless environments like Deno Deploy
let lastGenTime = Date.now();

function updateSyntheticDataIfNeeded() {
  if (!config.isLogging) return;

  const now = Date.now();
  if (now - lastGenTime >= config.interval) {
    // Determine how many intervals have passed (cap at 10 to avoid huge loops if paused)
    const ticks = Math.min(10, Math.floor((now - lastGenTime) / config.interval));

    for (let i = 0; i < ticks; i++) {
      const lastDs = latestData.ds || 26.0;
      const newDs = lastDs + (Math.random() - 0.5) * 0.4;
      const ds = Math.max(10, Math.min(40, newDs));

      const lastMoisture = latestData.moisture || 50;
      const newMoisture = lastMoisture + (Math.random() - 0.5) * 5;
      const moisture = Math.max(0, Math.min(100, newMoisture));

      // Calculate the approximate timestamp for this tick
      const tickTimeMs = lastGenTime + (i + 1) * config.interval;

      latestData = {
        ds,
        moisture,
        time: new Date(tickTimeMs).toISOString(),
      };

      history.push(latestData);
      if (history.length > 200) history.shift();
    }
    lastGenTime = now;
  }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Provide CORS headers for all API requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve static files
    if (url.pathname === "/" || url.pathname.startsWith("/static")) {
      return await serveDir(req, {
        fsRoot: "static",
        urlRoot: "",
        showIndex: true,
      });
    }

    // API: Get current data & history
    if (url.pathname === "/api/data") {
      updateSyntheticDataIfNeeded();
      return new Response(
        JSON.stringify({
          current: latestData,
          history,
          config,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // API: Receive data from ESP32
    if (url.pathname === "/api/report" && req.method === "POST") {
      const data = await req.json();
      latestData = {
        ds: data.temp || 0,
        moisture: data.moisture || 0,
        time: new Date().toISOString(),
      };

      if (config.isLogging) {
        history.push(latestData);
        if (history.length > 200) history.shift();
      }

      return new Response(
        JSON.stringify({ success: true, interval: config.interval }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // API: Update config
    if (url.pathname === "/api/config" && req.method === "POST") {
      const newConfig = await req.json();
      config = { ...config, ...newConfig };
      // Sync lastGenTime so we don't immediately generate multiple ticks upon restarting
      if (newConfig.isLogging) {
          lastGenTime = Date.now();
      }
      return new Response(
        JSON.stringify({ success: true, config }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // API: Calibration (placeholder)
    if (url.pathname === "/api/calibrate" && req.method === "POST") {
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("Server Error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : String(error) 
      }), 
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
