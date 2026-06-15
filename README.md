# Melbourne Flights

Live map of aircraft over Melbourne, on a dark Leaflet map. Planes are coloured by
altitude, rotated to their heading, smoothed at 60fps between updates, and clickable
for callsign / type / altitude / speed / climb-descent.

No API key required - data comes from the keyless [adsb.lol](https://adsb.lol) community
ADS-B feed, proxied through a Cloudflare Pages Function (`/api/flights`) that adds CORS
and edge-caches for 10s so all visitors share one upstream fetch.

## Architecture
- **Frontend** (`index.html`, `styles.css`, `app.js`) - Leaflet dark map; polls `/api/flights`
  every 10s and interpolates each aircraft to its new position each animation frame.
- **`functions/api/flights.js`** - Cloudflare Pages Function: fetches adsb.lol within ~240km of
  Melbourne, trims the payload, adds CORS, caches 10s.
- **Deploy** - GitHub Action (`.github/workflows/deploy-cf-pages.yml`) ships the site + Function to
  the `melbourne-flights` Cloudflare Pages project on every push to `master`. Repo secrets
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` drive it.

Live: https://melbourne-flights.pages.dev
