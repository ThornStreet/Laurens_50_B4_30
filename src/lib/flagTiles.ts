// Geometry helper for placing pre-baked flag tiles on the map.
//
// The flag images themselves (each clipped to its state's silhouette) are baked
// once by scripts/build-flag-tiles.mjs into public/flags/tiles/<ABBR>.png. At
// runtime we only need each state's geographic bounding box to drop its tile on
// the map as an `image` source. The antimeridian handling here MUST match the
// bake script's projection so the tile registers exactly with the borders.

type Poly = number[][][]; // a polygon: array of rings, each ring an array of [lng,lat]
// Minimal structural geometry — avoids depending on the global GeoJSON namespace
// (not resolvable under pnpm's strict node_modules). MapLibre's geometry, which
// carries `type` + `coordinates`, is assignable to this.
type Geom = { type: string; coordinates?: unknown };

/**
 * Polygons of a geometry. When a feature crosses the antimeridian (Alaska's
 * Aleutians wrap past +180°), the raw bbox would span the globe — so drop the
 * minority (positive-longitude) sub-polygons and keep the mainland.
 */
function polygonsOf(geom: Geom): Poly[] {
  const polys: Poly[] =
    geom.type === "Polygon"
      ? [geom.coordinates as Poly]
      : geom.type === "MultiPolygon"
      ? (geom.coordinates as Poly[])
      : [];

  let minL = Infinity;
  let maxL = -Infinity;
  for (const poly of polys) {
    for (const [lng] of poly[0]) {
      if (lng < minL) minL = lng;
      if (lng > maxL) maxL = lng;
    }
  }
  if (maxL - minL > 180) {
    const kept = polys.filter((poly) => poly[0][0][0] < 0);
    return kept.length ? kept : polys;
  }
  return polys;
}

/** image-source corner coordinates: [top-left, top-right, bottom-right, bottom-left] */
export type FlagCoordinates = [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
];

/** Geographic bounding box (as image-source corner coordinates) for a state. */
export function flagBounds(geom: Geom): FlagCoordinates | null {
  const polys = polygonsOf(geom);
  let W = Infinity;
  let S = Infinity;
  let E = -Infinity;
  let N = -Infinity;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        if (lng < W) W = lng;
        if (lng > E) E = lng;
        if (lat < S) S = lat;
        if (lat > N) N = lat;
      }
    }
  }
  if (!isFinite(W) || !isFinite(N)) return null;
  return [
    [W, N],
    [E, N],
    [E, S],
    [W, S],
  ];
}
