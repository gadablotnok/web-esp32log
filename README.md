# ESP32 Temperature Monitor Web Dashboard

Premium dashboard for monitoring ESP32 sensors (DS18B20 & LM35) hosted on Deno
Deploy.

## Features

- **Modern UI**: Glassmorphism design with animated backgrounds.
- **Real-time Updates**: Fetch data every 2.5 seconds.
- **Dummy Data**: Automatic generation on the server for testing.
- **Deno Native**: Optimized for Deno and Deno Deploy.

## Project Structure

- `main.ts`: Deno server/backend.
- `static/index.html`: The web dashboard.
- `deno.json`: Project configuration and tasks.

## Quick Start

1. Install Deno: `brew install deno` (macOS) or visit
   [deno.land](https://deno.land).
2. Run locally:
   ```bash
   deno task dev
   ```
3. Open `http://localhost:8000` in your browser.

## Deployment to Deno Deploy

The easiest way is to connect your GitHub repository to
[Deno Deploy](https://dash.deno.com) and select `main.ts` as the entry point.
