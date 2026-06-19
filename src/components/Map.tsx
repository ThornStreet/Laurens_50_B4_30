"use client";

import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { StateRecord, Celebration, Anchor } from "@/lib/types";
import { COLORS } from "@/lib/constants";
import { flagBounds } from "@/lib/flagTiles";
import { prefersReducedMotion } from "@/lib/useReducedMotion";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE_URL = `https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${TOKEN}`;

// Lift the focused state above the bottom sheet so the celebration rings
// (and the state itself, while editing) aren't hidden behind it.
const FOCUS_OFFSET: [number, number] = [0, -150];

// Opacity of a visited state's flag over the dark basemap.
const FLAG_OPACITY = 0.8;

type StateFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  { NAME: string; STATE_ABBR: string }
>;

type Props = {
  states: StateRecord[];
  onStateClick: (stateName: string) => void;
  celebration: Celebration | null;
  onAnchor: (anchor: Anchor) => void;
};

/**
 * Convert mapbox:// protocol URLs to their HTTPS equivalents
 * so MapLibre (which doesn't understand the mapbox:// protocol) can fetch them.
 */
function resolveMapboxUrl(url: string): string {
  if (!url.startsWith("mapbox://")) return url;

  if (url.startsWith("mapbox://sprites/")) {
    const path = url.replace("mapbox://sprites/", "");
    return `https://api.mapbox.com/styles/v1/${path}/sprite?access_token=${TOKEN}`;
  }

  if (url.startsWith("mapbox://fonts/")) {
    const path = url.replace("mapbox://fonts/", "");
    return `https://api.mapbox.com/fonts/v1/${path}?access_token=${TOKEN}`;
  }

  const tilesets = url.replace("mapbox://", "");
  return `https://api.mapbox.com/v4/${tilesets}.json?access_token=${TOKEN}&secure`;
}

function resolveStyle(raw: Record<string, unknown>): maplibregl.StyleSpecification {
  const sources: Record<string, unknown> = {};
  for (const [name, src] of Object.entries(
    raw.sources as Record<string, Record<string, unknown>>
  )) {
    if (typeof src.url === "string") {
      sources[name] = { ...src, url: resolveMapboxUrl(src.url) };
    } else {
      sources[name] = src;
    }
  }

  return {
    version: raw.version as number,
    sources,
    layers: raw.layers,
    sprite: resolveMapboxUrl(raw.sprite as string),
    glyphs: resolveMapboxUrl(raw.glyphs as string),
  } as maplibregl.StyleSpecification;
}

/** Flatten polygon/multipolygon rings to a flat list of [lng,lat] coords. */
function geometryCoords(geom: GeoJSON.Geometry): number[][] {
  if (geom.type === "Polygon") return (geom as GeoJSON.Polygon).coordinates.flat();
  if (geom.type === "MultiPolygon")
    return (geom as GeoJSON.MultiPolygon).coordinates.flat(2);
  return [];
}

/** Center of a coordinate set's bounding box (cheap, good enough for anchoring). */
function bboxCenter(coords: number[][]): [number, number] | null {
  if (coords.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of coords) {
    if (c[0] < minX) minX = c[0];
    if (c[1] < minY) minY = c[1];
    if (c[0] > maxX) maxX = c[0];
    if (c[1] > maxY) maxY = c[1];
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

export default function Map({ states, onStateClick, celebration, onAnchor }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const statesRef = useRef(states);
  const celebrateRaf = useRef<number | null>(null);
  const restingZoomRef = useRef<number | null>(null);
  const featuresByNameRef = useRef<globalThis.Map<string, StateFeature> | null>(null);
  const visitedSigRef = useRef("");

  // Drape each visited state in its pre-baked flag tile (a PNG clipped to the
  // state shape, placed as an image source over the state's bbox). The tile
  // fades in on load; un-visited states fade their flag back out. The MapLibre
  // layer itself is the "already added" record, so no extra bookkeeping is kept.
  const syncFlags = useCallback(() => {
    const m = map.current;
    const byName = featuresByNameRef.current;
    if (!m || !byName) return;
    const reduce = prefersReducedMotion();

    for (const s of statesRef.current) {
      const feat = byName.get(s.name);
      if (!feat) continue;
      const abbr = feat.properties.STATE_ABBR;
      const layerId = `flag-${abbr}`;

      if (m.getLayer(layerId)) {
        m.setPaintProperty(layerId, "raster-opacity", s.visited ? FLAG_OPACITY : 0);
        continue;
      }
      if (!s.visited) continue;

      const coordinates = flagBounds(feat.geometry);
      if (!coordinates || m.getSource(`flag-src-${abbr}`)) continue;

      m.addSource(`flag-src-${abbr}`, {
        type: "image",
        url: `/flags/tiles/${abbr}.png`,
        coordinates,
      });
      m.addLayer(
        {
          id: layerId,
          type: "raster",
          source: `flag-src-${abbr}`,
          paint: {
            // Static opacity: the tile fades in on load via raster-fade-duration,
            // and opacity transitions handle un-visit / re-visit toggles.
            "raster-opacity": FLAG_OPACITY,
            "raster-fade-duration": reduce ? 0 : 300,
            "raster-opacity-transition": { duration: reduce ? 0 : 400 },
          },
        },
        m.getLayer("state-borders") ? "state-borders" : undefined
      );
    }
  }, []);

  // Update visited borders + flags whenever the set of visited states changes.
  useEffect(() => {
    statesRef.current = states;

    // Gate on a layer existing (i.e. we're past 'load') rather than
    // isStyleLoaded(), which can be transiently false while sources load.
    const m = map.current;
    if (!m || !m.getLayer("state-visited-border")) return;

    // Only the visited set affects borders/flags — skip notes/date edits.
    const unvisitedList = states.filter((s) => !s.visited).map((s) => s.name);
    const visitedSig = states
      .filter((s) => s.visited)
      .map((s) => s.name)
      .join("|");
    if (visitedSig === visitedSigRef.current) return;
    visitedSigRef.current = visitedSig;

    m.setPaintProperty("state-visited-border", "line-opacity", [
      "case",
      ["in", ["get", "NAME"], ["literal", unvisitedList]],
      0,
      0.5,
    ]);

    syncFlags();
  }, [states, syncFlags]);

  // One-time map init.
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const container = mapContainer.current;
    let cancelled = false;

    async function init() {
      const [raw, geojson] = await Promise.all([
        fetch(STYLE_URL).then((r) => r.json()),
        fetch("/states.geojson").then((r) => r.json()),
      ]);
      const style = resolveStyle(raw);

      if (cancelled) return;

      // Index features by state name so flags can be looked up + clipped.
      const byName = new globalThis.Map<string, StateFeature>();
      for (const f of (geojson.features ?? []) as StateFeature[]) {
        byName.set(f.properties.NAME, f);
      }
      featuresByNameRef.current = byName;

      map.current = new maplibregl.Map({
        container,
        style,
        center: [-98.5, 39.8],
        zoom: 3.5,
        minZoom: 2,
        maxZoom: 10,
        attributionControl: false,
      });

      map.current.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );

      map.current.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );

      map.current.on("load", () => {
        map.current!.addSource("states", {
          type: "geojson",
          data: geojson,
          generateId: true,
        });

        const unvisitedList = statesRef.current
          .filter((s) => !s.visited)
          .map((s) => s.name);

        // Transparent fill kept purely for click/hover hit-testing; the visited
        // look now comes from each state's flag raster (see syncFlags).
        map.current!.addLayer({
          id: "state-fills",
          type: "fill",
          source: "states",
          paint: {
            "fill-color": "#000000",
            "fill-opacity": 0,
          },
        });

        map.current!.addLayer({
          id: "state-borders",
          type: "line",
          source: "states",
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.15,
            "line-width": 1,
          },
        });

        // Mint outline that only shows on visited states.
        map.current!.addLayer({
          id: "state-visited-border",
          type: "line",
          source: "states",
          paint: {
            "line-color": COLORS.mint400,
            "line-width": 1.2,
            "line-opacity": [
              "case",
              ["in", ["get", "NAME"], ["literal", unvisitedList]],
              0,
              0.5,
            ] as unknown as number,
          },
        });

        // Hover highlight layer
        map.current!.addLayer({
          id: "state-hover",
          type: "fill",
          source: "states",
          paint: {
            "fill-color": "#ffffff",
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.12,
              0,
            ] as unknown as number,
          },
        });

        // Title label over Canada
        map.current!.addSource("title-label", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-96, 56] },
            properties: {},
          },
        });

        map.current!.addLayer({
          id: "title-label",
          type: "symbol",
          source: "title-label",
          layout: {
            "text-field": "Lauren's 50 B4 30",
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2, 24,
              3.5, 42,
              6, 80,
            ],
            "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
            "text-letter-spacing": 0.3,
            "symbol-placement": "point",
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": COLORS.mint300,
            "text-opacity": 0.55,
            "text-halo-color": "#0a0a0a",
            "text-halo-width": 1.4,
            "text-halo-blur": 1,
          },
        });

        // Click handler — fly to state, then open panel
        map.current!.on("click", "state-fills", (e) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];
          const name = feature.properties?.NAME;
          if (!name) return;

          const center = bboxCenter(
            geometryCoords(feature.geometry as GeoJSON.Geometry)
          );

          if (center) {
            const currentZoom = map.current!.getZoom();
            map.current!.flyTo({
              center,
              zoom: Math.max(currentZoom, 4.5),
              offset: FOCUS_OFFSET,
              duration: 800,
            });
          }

          setTimeout(() => onStateClick(name), 500);
        });

        // Hover highlight via feature state
        let hoveredId: string | number | null = null;

        map.current!.on("mousemove", "state-fills", (e) => {
          map.current!.getCanvas().style.cursor = "pointer";
          if (!e.features || e.features.length === 0) return;
          const id = e.features[0].id;
          if (id === hoveredId) return;

          // Clear previous
          if (hoveredId !== null && hoveredId !== undefined) {
            map.current!.setFeatureState(
              { source: "states", id: hoveredId },
              { hover: false }
            );
          }

          hoveredId = id ?? null;
          if (hoveredId !== null && hoveredId !== undefined) {
            map.current!.setFeatureState(
              { source: "states", id: hoveredId },
              { hover: true }
            );
          }
        });

        map.current!.on("mouseleave", "state-fills", () => {
          map.current!.getCanvas().style.cursor = "";
          if (hoveredId !== null && hoveredId !== undefined) {
            map.current!.setFeatureState(
              { source: "states", id: hoveredId },
              { hover: false }
            );
          }
          hoveredId = null;
        });

        // Drape any already-visited states in their flags on first paint.
        syncFlags();
      });
    }

    init();

    return () => {
      cancelled = true;
      if (celebrateRaf.current) cancelAnimationFrame(celebrateRaf.current);
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Celebration: anchor the overlay to the state, bloom a glow line, breathe the camera.
  useEffect(() => {
    const m = map.current;
    if (!celebration || !m) return;

    // Resolve the celebrated state's center. querySourceFeatures only works once
    // the style is up; otherwise fall back to the map center so the anchor (and
    // therefore the toast/rings) is always emitted and never silently dropped.
    const styleReady = m.isStyleLoaded();
    let center: [number, number] | null = null;
    if (styleReady) {
      const feats = m.querySourceFeatures("states", {
        filter: ["==", ["get", "NAME"], celebration.name],
      });
      let coords: number[][] = [];
      for (const f of feats) {
        coords = coords.concat(geometryCoords(f.geometry as GeoJSON.Geometry));
      }
      center = bboxCenter(coords);
    }
    if (!center) {
      const c = m.getCenter();
      center = [c.lng, c.lat];
    }
    const px = m.project(center);
    onAnchor({ x: px.x, y: px.y, seq: celebration.seq });

    // Map-side motion only when the style is ready and motion is allowed.
    if (!styleReady || prefersReducedMotion()) return;

    // Expanding glow line traced on the state's border.
    if (m.getLayer("state-celebrate")) m.removeLayer("state-celebrate");
    m.addLayer({
      id: "state-celebrate",
      type: "line",
      source: "states",
      filter: ["==", ["get", "NAME"], celebration.name],
      paint: {
        "line-color": COLORS.mint300,
        "line-blur": 3,
        "line-width": 1,
        "line-opacity": 0.9,
      },
    });

    const start = performance.now();
    const DURATION = 800;
    const step = (now: number) => {
      const mc = map.current;
      if (!mc || !mc.getLayer("state-celebrate")) return;
      const t = Math.min(1, (now - start) / DURATION);
      mc.setPaintProperty("state-celebrate", "line-width", 1 + 4 * Math.sin(t * Math.PI));
      mc.setPaintProperty("state-celebrate", "line-opacity", 0.9 * (1 - t));
      if (t < 1) {
        celebrateRaf.current = requestAnimationFrame(step);
      } else {
        mc.removeLayer("state-celebrate");
        celebrateRaf.current = null;
      }
    };
    celebrateRaf.current = requestAnimationFrame(step);

    // Subtle camera "breath" in and back. Ease back to a persisted resting zoom
    // (not the live zoom) so rapid celebrations can't ratchet the zoom upward.
    if (restingZoomRef.current == null) restingZoomRef.current = m.getZoom();
    const resting = restingZoomRef.current;
    m.easeTo({ center, zoom: resting + 0.25, offset: FOCUS_OFFSET, duration: 500 });
    const settle = setTimeout(() => {
      map.current?.easeTo({
        center: center!,
        zoom: resting,
        offset: FOCUS_OFFSET,
        duration: 450,
      });
      restingZoomRef.current = null;
    }, 540);

    return () => {
      clearTimeout(settle);
      if (celebrateRaf.current) {
        cancelAnimationFrame(celebrateRaf.current);
        celebrateRaf.current = null;
      }
      if (map.current?.getLayer("state-celebrate")) {
        map.current.removeLayer("state-celebrate");
      }
    };
  }, [celebration?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mapContainer}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
