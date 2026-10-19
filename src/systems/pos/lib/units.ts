/**
 * Recipe units, same rules as the web (lib/unitConversion.ts): a recipe can be typed
 * in g / ml while the ingredient is stocked in kg / L; the server always gets the stock unit.
 */

/** "kilogram" → "kg", "ltr" → "L"… anything else stays as it is. */
function normalizeUnit(unit: string): string {
  const u = (unit || "").toLowerCase().trim();
  if (u === "kg" || u === "kilogram" || u === "kilograms") return "kg";
  if (u === "g" || u === "gm" || u === "gram" || u === "grams") return "g";
  if (["l", "ltr", "liter", "liters", "litre", "litres"].includes(u)) return "L";
  if (u === "ml" || u === "milliliter" || u === "milliliters") return "ml";
  return unit || "";
}

/** Units a recipe amount can be typed in: kg → g / kg, L → ml / L, others only their own unit. */
export function compatibleUnits(stockUnit: string): string[] {
  const unit = normalizeUnit(stockUnit);
  if (unit === "kg" || unit === "g") return ["g", "kg"];
  if (unit === "L" || unit === "ml") return ["ml", "L"];
  return stockUnit ? [stockUnit] : [];
}

/** How a saved amount is shown in the form: 0.25 kg → "250" g; 1.5 kg stays "1.5" kg. */
export function inputAmount(stockUnit: string, stockQty: number): { qty: string; unit: string } {
  const unit = normalizeUnit(stockUnit);
  const text = (n: number) => (n ? String(Number(n.toFixed(4))) : "");
  if ((unit === "kg" || unit === "L") && stockQty > 0 && stockQty < 1) {
    return { qty: text(stockQty * 1000), unit: unit === "kg" ? "g" : "ml" };
  }
  if (unit === "kg" || unit === "L") return { qty: text(stockQty), unit };
  return { qty: text(stockQty), unit: stockUnit };
}

/** Typed amount → the ingredient's stock unit (500 g → 0.5 kg). */
export function toStockUnit(qty: number, inputUnit: string, stockUnit: string): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const from = normalizeUnit(inputUnit);
  const to = normalizeUnit(stockUnit);
  if (from === to) return qty;
  if ((from === "g" && to === "kg") || (from === "ml" && to === "L")) return qty / 1000;
  if ((from === "kg" && to === "g") || (from === "L" && to === "ml")) return qty * 1000;
  return qty;
}

/** "= 0.5 kg in inventory" when the typed unit differs from the stock unit. */
export function conversionPreview(qtyText: string, inputUnit: string, stockUnit: string): string | null {
  const qty = Number(qtyText);
  if (!qtyText || !Number.isFinite(qty) || qty <= 0 || normalizeUnit(inputUnit) === normalizeUnit(stockUnit)) return null;
  return `= ${Number(toStockUnit(qty, inputUnit, stockUnit).toFixed(4))} ${stockUnit} in inventory`;
}

/** "12.5" / "3" — stock amounts without trailing zeros. */
export const qtyText = (n: number) => String(Number(n.toFixed(3)));