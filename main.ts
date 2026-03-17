import { serveDir } from "std/http/file_server.ts";

// In-memory state (resets on deploy/restart)
let history = [];
let config = {
  interval: 2000, // ms
  isLogging: true,
  dryValue: 4095,
  wetValue: 1500
};

Deno.serve((req) => {
  const url = new URL(req.url);

  // Serve static files
  if (url.pathname === "/" || url.pathname.startsWith("/static")) {
    return serveDir(req, {
      fsRoot: "static",
      showIndex: true,
    });
  }

  // API: Get current data & history
  if (url.pathname === "/api/data") {
    // DS18B20: high precision, small fluctuations (±0.3°C) around 27.5
    const ds = 27.5 + (Math.random() - 0.5) * 0.6;
    // Soil Moisture proxy for demo - actual logic in ESP32 later
    // For now, let's simulate the ESP32 already calculating 0-100%
    const moisture = Math.floor(Math.random() * 100);
    
    const record = {
      time: new Date().toISOString(),
      ds,
      moisture
    };

    if (config.isLogging) {
      history.push(record);
      if (history.length > 100) history.shift();
    }

    return new Response(JSON.stringify({ 
      current: record, 
      history, 
      config 
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // API: Update config
  if (url.pathname === "/api/config" && req.method === "POST") {
    return req.json().then(newConfig => {
      config = { ...config, ...newConfig };
      return new Response(JSON.stringify({ success: true, config }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    });
  }

  // API: Calibration commands (to be fetched by ESP32)
  if (url.pathname === "/api/calibrate" && req.method === "POST") {
     // This would set a flag that the ESP32 picks up
     return new Response(JSON.stringify({ success: true }), {
       headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
     });
  }

  return new Response("Not Found", { status: 404 });
});
