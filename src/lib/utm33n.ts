/**
 * WGS84 (lon, lat) → ETRS89/UTM zone 33N (EPSG:25833)
 * Central meridian: 15°E  |  False easting: 500 000 m  |  Scale k0: 0.9996
 * Accurate to ~1 m across Norway.
 */
export function wgs84ToUtm33N(lon: number, lat: number): [number, number] {
  const a   = 6378137.0;
  const f   = 1 / 298.257223563;
  const k0  = 0.9996;
  const lon0 = 15 * Math.PI / 180;  // central meridian
  const FE  = 500_000;

  const phi  = lat * Math.PI / 180;
  const lam  = lon * Math.PI / 180;

  const e2 = 2 * f - f * f;
  const n  = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const t  = Math.tan(phi) ** 2;
  const c  = (e2 / (1 - e2)) * Math.cos(phi) ** 2;
  const A  = (lam - lon0) * Math.cos(phi);

  // Meridional arc M
  const e4 = e2 * e2, e6 = e4 * e2;
  const M  = a * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * phi)
    + (15 * e4 / 256 + 45 * e6 / 1024)            * Math.sin(4 * phi)
    - (35 * e6 / 3072)                             * Math.sin(6 * phi)
  );

  const easting = FE + k0 * n * (
    A
    + (1 - t + c)                                              * A ** 3 / 6
    + (5 - 18 * t + t * t + 72 * c - 58 * (e2 / (1 - e2)))   * A ** 5 / 120
  );

  const northing = k0 * (
    M + n * Math.tan(phi) * (
      A ** 2 / 2
      + (5 - t + 9 * c + 4 * c * c)                              * A ** 4 / 24
      + (61 - 58 * t + t * t + 600 * c - 330 * (e2 / (1 - e2))) * A ** 6 / 720
    )
  );

  return [Math.round(easting), Math.round(northing)];
}
