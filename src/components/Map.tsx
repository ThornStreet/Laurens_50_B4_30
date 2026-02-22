"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { StateRecord } from "@/lib/types";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const STYLE_URL = `https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${TOKEN}`;

type Props = {
  states: StateRecord[];
  onStateClick: (stateName: string) => void;
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

export default function Map({ states, onStateClick }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const statesRef = useRef(states);

  // Update map fill colors when states change
  useEffect(() => {
    statesRef.current = states;

    if (!map.current || !map.current.isStyleLoaded()) return;

    const unvisitedList = states
      .filter((s) => !s.visited)
      .map((s) => s.name);

    map.current.setPaintProperty("state-fills", "fill-color", [
      "case",
      ["in", ["get", "NAME"], ["literal", unvisitedList]],
      "transparent",
      "#22c55e",
    ]);

    map.current.setPaintProperty("state-fills", "fill-opacity", [
      "case",
      ["in", ["get", "NAME"], ["literal", unvisitedList]],
      0,
      0.35,
    ]);
  }, [states]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const container = mapContainer.current;
    let cancelled = false;

    async function init() {
      const res = await fetch(STYLE_URL);
      const raw = await res.json();
      const style = resolveStyle(raw);

      if (cancelled) return;

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
          data: "/states.geojson",
          generateId: true,
        });

        const unvisitedList = statesRef.current
          .filter((s) => !s.visited)
          .map((s) => s.name);

        map.current!.addLayer({
          id: "state-fills",
          type: "fill",
          source: "states",
          paint: {
            "fill-color": [
              "case",
              ["in", ["get", "NAME"], ["literal", unvisitedList]],
              "transparent",
              "#22c55e",
            ] as unknown as string,
            "fill-opacity": [
              "case",
              ["in", ["get", "NAME"], ["literal", unvisitedList]],
              0,
              0.35,
            ] as unknown as number,
          },
        });

        map.current!.addLayer({
          id: "state-borders",
          type: "line",
          source: "states",
          paint: {
            "line-color": "#ffffff",
            "line-opacity": 0.2,
            "line-width": 1,
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
              0.15,
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
            "text-color": "#ffffff",
            "text-opacity": 0.7,
          },
        });

        // Click handler — fly to state, then open panel
        map.current!.on("click", "state-fills", (e) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];
          const name = feature.properties?.NAME;
          if (!name) return;

          // Compute centroid from geometry coordinates
          const geom = feature.geometry as GeoJSON.Geometry;
          let coords: number[][] = [];
          if (geom.type === "Polygon") {
            coords = (geom as GeoJSON.Polygon).coordinates.flat();
          } else if (geom.type === "MultiPolygon") {
            coords = (geom as GeoJSON.MultiPolygon).coordinates.flat(2);
          }

          if (coords.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const c of coords) {
              if (c[0] < minX) minX = c[0];
              if (c[1] < minY) minY = c[1];
              if (c[0] > maxX) maxX = c[0];
              if (c[1] > maxY) maxY = c[1];
            }
            const center: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2];
            const currentZoom = map.current!.getZoom();

            map.current!.flyTo({
              center,
              zoom: Math.max(currentZoom, 4.5),
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
      });
    }

    init();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={mapContainer}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}
