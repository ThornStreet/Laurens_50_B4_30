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

        // Click handler for states
        map.current!.on("click", "state-fills", (e) => {
          if (e.features && e.features.length > 0) {
            const name = e.features[0].properties?.NAME;
            if (name) onStateClick(name);
          }
        });

        // Change cursor on hover
        map.current!.on("mouseenter", "state-fills", () => {
          map.current!.getCanvas().style.cursor = "pointer";
        });
        map.current!.on("mouseleave", "state-fills", () => {
          map.current!.getCanvas().style.cursor = "";
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
