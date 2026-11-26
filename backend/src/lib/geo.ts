// ~0.005° ≈ 550 m. Exact coordinates never leave the server; only this grid does.
const GRID = 0.005;

export const roundCoord = (v: number) => Math.round(v / GRID) * GRID;

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Shown in the app as "2.4 km"; we never claim more precision than the grid.
export const displayKm = (km: number) => Math.max(0.5, Math.round(km * 2) / 2);
