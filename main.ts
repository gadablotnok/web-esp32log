import { serveDir } from "std/http/file_server.ts";

Deno.serve((req) => {
  const url = new URL(req.url);

  // Serve the dashboard
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return serveDir(req, {
      fsRoot: "static",
      showIndex: true,
    });
  }

  // API endpoint for data
  if (url.pathname === "/data") {
    // DS18B20: high precision, small fluctuations (±0.3°C) around 27.5
    const ds = 27.5 + (Math.random() - 0.5) * 0.6;
    // LM35: slightly noisier analog reading (±0.8°C) around 28.2
    const lm = 28.2 + (Math.random() - 0.5) * 1.6;
    
    return new Response(JSON.stringify({ ds, lm }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  }

  // Not found
  return new Response("Not Found", { status: 404 });
});
