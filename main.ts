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
  time: new Date().toISOString()
};
let config = {
  interval: 2000, 
  isLogging: true,
  dryValue: 4095,
  wetValue: 1500
};

// --- DATA SYNTHESIS GENERATOR ---
// This generates dummy data automatically so the dashboard looks "alive"
function generateSyntheticData() {
  if (!config.isLogging) return;

  // Simulate Suhu DS18B20: 24-28 C with small drifts
  const lastDs = latestData.ds || 26.0;
  const newDs = lastDs + (Math.random() - 0.5) * 0.4;
  const ds = Math.max(10, Math.min(40, newDs)); // Clamp for realistic ranges

  // Simulate Moisture: 0-100% with drifts
  const lastMoisture = latestData.moisture || 50;
  const newMoisture = lastMoisture + (Math.random() - 0.5) * 5;
  const moisture = Math.max(0, Math.min(100, newMoisture));

  latestData = {
    ds,
    moisture,
    time: new Date().toISOString()
  };

  history.push(latestData);
  if (history.length > 200) history.shift();
}

// Start auto-generation
setInterval(generateSyntheticData, config.interval);

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
    return new Response(JSON.stringify({ 
      current: latestData, 
      history, 
      config 
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // API: Receive data from ESP32 (Still works if user connects it)
  if (url.pathname === "/api/report" && req.method === "POST") {
    return req.json().then(data => {
      // If real data comes in, it updates latestData
      latestData = {
        ds: data.temp,
        moisture: data.moisture,
        time: new Date().toISOString()
      };
      
      if (config.isLogging) {
        history.push(latestData);
        if (history.length > 200) history.shift();
      }
      
      return new Response(JSON.stringify({ success: true, interval: config.interval }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
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

  return new Response("Not Found", { status: 404 });
});
