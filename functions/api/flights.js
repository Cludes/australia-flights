/**
 * Cloudflare Pages Function - GET /api/flights
 *
 * Proxies the keyless adsb.lol community ADS-B feed (which sends no CORS), adds
 * CORS, trims it to what the map needs, and edge-caches for 10s so all visitors
 * share one upstream fetch (polite to the free API).
 */

const SRC = 'https://api.adsb.lol/v2/lat/-37.8136/lon/144.9631/dist/130'; // ~240km around Melbourne
const CACHE_TTL = 10;

export async function onRequestOptions() {
  return cors(new Response(null, { status: 204 }));
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL(context.request.url).origin + '/__flights', { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cors(cached);

  let upstream;
  try {
    upstream = await fetch(SRC, { headers: { 'User-Agent': 'melbourne-flights (cloudflare pages)' } });
  } catch (e) {
    return cors(json({ error: 'upstream fetch failed', detail: String(e) }, 502));
  }
  if (!upstream.ok) return cors(json({ error: `upstream HTTP ${upstream.status}` }, 502));

  let data;
  try { data = await upstream.json(); } catch (e) { return cors(json({ error: 'bad upstream json' }, 502)); }

  const aircraft = [];
  for (const a of data.ac || []) {
    if (a.lat == null || a.lon == null) continue;
    const onGround = a.alt_baro === 'ground';
    if (onGround) continue; // map shows airborne traffic
    aircraft.push({
      hex:    a.hex,
      flight: (a.flight || '').trim() || null,
      reg:    a.r || null,
      type:   a.t || null,
      lat:    a.lat,
      lon:    a.lon,
      alt:    typeof a.alt_baro === 'number' ? a.alt_baro : (a.alt_geom ?? null),
      speed:  a.gs ?? null,                       // knots
      track:  a.track ?? a.true_heading ?? null,  // degrees
      vsi:    a.baro_rate ?? a.geom_rate ?? null, // ft/min
      squawk: a.squawk || null,
    });
  }

  const resp = json({ fetched_at: new Date().toISOString(), count: aircraft.length, aircraft });
  resp.headers.set('Cache-Control', `public, max-age=${CACHE_TTL}`);
  context.waitUntil(cache.put(cacheKey, resp.clone()));
  return cors(resp);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
function cors(resp) {
  const h = new Headers(resp.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  return new Response(resp.body, { status: resp.status, headers: h });
}
