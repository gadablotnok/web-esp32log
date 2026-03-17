import { serveDir } from "std/http/file_server.ts";
import mqtt from "npm:mqtt";

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
  time: new Date().toISOString(),
};
let config = {
  interval: 2000,
  isLogging: true,
  dryValue: 4095,
  wetValue: 1500,
};

// --- CREDENTIALS (USER MUST FILL THESE) ---
// Note: for production, use environment variables!
const MQTT_BROKER = "mqtts://xxx.hivemq.cloud:8883"; 
const MQTT_USERNAME = "your_username";
const MQTT_PASSWORD = "your_password";
// ------------------------------------------

let connectedToEsp = false;
let initSamples = 0;
let lastDataTime = Date.now();

// MQTT Setup
const clientId = "deno-server-" + Math.random().toString(16).slice(2);
const client = mqtt.connect(MQTT_BROKER, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: clientId
});

client.on('connect', () => {
    console.log("[MQTT] Connected to Broker!");
    client.subscribe("esp32/data");
});

client.on('error', (err) => {
    console.error("[MQTT] Error:", err);
});

client.on('message', (topic, message) => {
    if (topic === "esp32/data") {
        try {
            const data = JSON.parse(message.toString());
            latestData = {
                ds: data.temp || 0,
                moisture: data.moisture || 0,
                time: new Date().toISOString()
            };
            
            lastDataTime = Date.now();

            if (!connectedToEsp) {
                initSamples++;
                console.log(`[MQTT] Menerima sample awal: ${initSamples}/3`);
                if (initSamples >= 3) {
                    connectedToEsp = true;
                    console.log("[MQTT] ESP32 Terhubung! Mengembalikan interval config...");
                    client.publish("esp32/config", JSON.stringify(config));
                }
            }
            
            if (config.isLogging) {
                history.push(latestData);
                if (history.length > 200) history.shift();
            }
        } catch (e) {
            console.error("Invalid MQTT payload:", e);
        }
    }
});

// Watchdog to check ESP32 connection
setInterval(() => {
    // If we haven't received data for a while (configurable timeout maxing at 10s)
    const timeout = Math.max(config.interval + 2000, 10000);
    if (connectedToEsp && (Date.now() - lastDataTime > timeout)) {
        console.log("[Watchdog] ESP32 Timeout! Koneksi terputus.");
        connectedToEsp = false;
        initSamples = 0;
    }
}, 2000);

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
      return new Response(
        JSON.stringify({
          current: latestData,
          history,
          config,
          connectedToEsp,
          initSamples
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // API: Receive data from ESP32 via HTTP (Fallback)
    if (url.pathname === "/api/report" && req.method === "POST") {
      const data = await req.json();
      latestData = {
        ds: data.temp || 0,
        moisture: data.moisture || 0,
        time: new Date().toISOString(),
      };

      lastDataTime = Date.now();
      
      if (!connectedToEsp) {
          initSamples++;
          if (initSamples >= 3) connectedToEsp = true;
      }

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
      
      // Send the new config to ESP32 via MQTT
      if (client.connected) {
          client.publish("esp32/config", JSON.stringify(config));
      }

      return new Response(
        JSON.stringify({ success: true, config }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // API: Calibration
    if (url.pathname === "/api/calibrate" && req.method === "POST") {
      const payload = await req.json();
      if (client.connected) {
          client.publish("esp32/calibrate", JSON.stringify({ mode: payload.mode }));
      }
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
