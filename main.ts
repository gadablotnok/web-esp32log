import { serveDir } from "std/http/file_server.ts";

interface DataPoint {
  ds: number;
  moisture: number;
  time: string;
}

// In-memory state
let history: DataPoint[] = [];
let latestData: DataPoint = {
  ds: 0,
  moisture: 0,
  time: new Date().toISOString()
};
let config = {
  interval: 2000, 
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
    return new Response(JSON.stringify({ 
      current: latestData, 
      history, 
      config 
    }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // API: Receive data from ESP32
  if (url.pathname === "/api/report" && req.method === "POST") {
    return req.json().then(data => {
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

  // API: Calibration (placeholder)
  if (url.pathname === "/api/calibrate" && req.method === "POST") {
     return new Response(JSON.stringify({ success: true }), {
       headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
     });
  }

  return new Response("Not Found", { status: 404 });
});
