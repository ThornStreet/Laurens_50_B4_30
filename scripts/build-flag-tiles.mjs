// Pre-bakes each U.S. state's flag, clipped to that state's exact silhouette,
// into a transparent PNG placed in public/flags/tiles/<ABBR>.png. These static
// tiles are dropped onto the map as MapLibre `image` sources at runtime (see
// src/components/Map.tsx + src/lib/flagTiles.ts), so the heavy clipping happens
// once here instead of in the browser on every visit.
//
// The clip uses the SAME projection as the runtime bbox (Web Mercator, with an
// antimeridian guard for Alaska), so the baked PNG registers exactly with the
// state borders the map draws.
//
// No npm deps: it serves the inputs from a throwaway Node HTTP server and does
// the rasterization in headless Chrome (a 2D canvas, no WebGL needed).
//
// Usage:  node scripts/build-flag-tiles.mjs   (or: npm run flags:build)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SVG_DIR = path.join(ROOT, "scripts/flag-svgs");
const GEOJSON = path.join(ROOT, "public/states.geojson");
const OUT_DIR = path.join(ROOT, "public/flags/tiles");
const RESOLUTION = 1024; // max canvas dimension of a baked tile
const PORT = 8799;

fs.mkdirSync(OUT_DIR, { recursive: true });

function findChrome() {
  const candidates = [
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
  ];
  for (const c of candidates) {
    const r = spawnSync("which", [c], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  throw new Error("No Chrome/Chromium binary found (tried: " + candidates.join(", ") + ")");
}

// The in-browser generator. Clips every flag and POSTs each PNG back to us.
// Keep this projection in lockstep with src/lib/flagTiles.ts (flagBounds).
const GEN_HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
const RES = ${RESOLUTION};
function mercY(lat){const c=Math.max(-85.05,Math.min(85.05,lat));return Math.log(Math.tan(Math.PI/4+c*Math.PI/360))*(180/Math.PI);}
function polygonsOf(geom){
  const polys = geom.type==='Polygon'?[geom.coordinates]:geom.type==='MultiPolygon'?geom.coordinates:[];
  let minL=Infinity,maxL=-Infinity;
  for(const p of polys) for(const [lng] of p[0]){if(lng<minL)minL=lng;if(lng>maxL)maxL=lng;}
  if(maxL-minL>180){const k=polys.filter(p=>p[0][0][0]<0);return k.length?k:polys;}
  return polys;
}
function loadImage(url){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=url;});}
function toBlob(c){return new Promise(r=>c.toBlob(r,'image/png'));}
async function buildTile(geom, svgUrl){
  const polys=polygonsOf(geom);
  let W=Infinity,S=Infinity,E=-Infinity,N=-Infinity;
  for(const p of polys)for(const ring of p)for(const[lng,lat]of ring){if(lng<W)W=lng;if(lng>E)E=lng;if(lat<S)S=lat;if(lat>N)N=lat;}
  const lngSpan=E-W, mN=mercY(N), mS=mercY(S), mSpan=mN-mS;
  if(lngSpan<=0||mSpan<=0) return null;
  let w,h;
  if(lngSpan>=mSpan){w=RES;h=Math.max(1,Math.round(RES*mSpan/lngSpan));}else{h=RES;w=Math.max(1,Math.round(RES*lngSpan/mSpan));}
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');
  const img=await loadImage(svgUrl);
  if(!img) return null;
  ctx.beginPath();
  for(const p of polys)for(const ring of p){ring.forEach(([lng,lat],i)=>{const x=((lng-W)/lngSpan)*w;const y=((mN-mercY(lat))/mSpan)*h;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.closePath();}
  ctx.clip();
  let iw=img.naturalWidth||3, ih=img.naturalHeight||2;
  const sc=Math.max(w/iw,h/ih);
  ctx.drawImage(img,(w-iw*sc)/2,(h-ih*sc)/2,iw*sc,ih*sc);
  try{ return await toBlob(canvas); }catch(e){ return null; }
}
(async()=>{
  const gj = await fetch('/states.geojson').then(r=>r.json());
  let ok=0, fail=[];
  for(const f of gj.features){
    const abbr=f.properties.STATE_ABBR;
    try{
      const blob=await buildTile(f.geometry,'/svg/'+abbr+'.svg');
      if(blob){ await fetch('/tile/'+encodeURIComponent(abbr),{method:'POST',body:blob}); ok++; }
      else { fail.push(abbr); }
    }catch(e){ fail.push(abbr+':'+e.message); }
  }
  await fetch('/done',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ok,fail})});
})();
</script></body></html>`;

const written = [];
let finished = false;

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  if (req.method === "POST" && url.startsWith("/tile/")) {
    const abbr = decodeURIComponent(url.slice("/tile/".length));
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      fs.writeFileSync(path.join(OUT_DIR, abbr + ".png"), Buffer.concat(chunks));
      written.push(abbr);
      process.stdout.write(`  ✓ ${abbr}\n`);
      res.end("ok");
    });
    return;
  }
  if (req.method === "POST" && url === "/done") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.end("ok");
      let summary = {};
      try { summary = JSON.parse(body); } catch {}
      finish(summary);
    });
    return;
  }
  if (url === "/" || url === "/gen.html") {
    res.setHeader("content-type", "text/html");
    return res.end(GEN_HTML);
  }
  if (url === "/states.geojson") {
    res.setHeader("content-type", "application/json");
    return res.end(fs.readFileSync(GEOJSON));
  }
  if (url.startsWith("/svg/")) {
    const file = path.join(SVG_DIR, path.basename(decodeURIComponent(url)));
    if (fs.existsSync(file)) {
      res.setHeader("content-type", "image/svg+xml");
      return res.end(fs.readFileSync(file));
    }
  }
  res.statusCode = 404;
  res.end("not found");
});

let chrome;
function finish(summary = {}) {
  if (finished) return;
  finished = true;
  try { if (chrome) chrome.kill("SIGKILL"); } catch {}
  server.close();
  const allAbbrs = JSON.parse(fs.readFileSync(GEOJSON, "utf8")).features.map(
    (f) => f.properties.STATE_ABBR
  );
  const missing = allAbbrs.filter((a) => !written.includes(a));
  console.log(`\nBaked ${written.length}/${allAbbrs.length} flag tiles -> public/flags/tiles/`);
  if (summary.fail && summary.fail.length) console.log("  failed in-page:", summary.fail.join(", "));
  if (missing.length) {
    console.error("  MISSING:", missing.join(", "));
    process.exitCode = 1;
  }
}

server.listen(PORT, () => {
  const chromeBin = findChrome();
  console.log(`Baking flag tiles with ${path.basename(chromeBin)} ...`);
  chrome = spawn(
    chromeBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--remote-debugging-port=0", // keeps the process alive while the page runs
      `http://localhost:${PORT}/gen.html`,
    ],
    { stdio: "ignore" }
  );
  chrome.on("error", (e) => {
    console.error("Failed to launch Chrome:", e.message);
    process.exit(1);
  });
});

// Safety net: don't hang forever.
setTimeout(() => {
  if (!finished) {
    console.error("Timed out after 180s.");
    finish();
  }
}, 180000);
