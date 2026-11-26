// All amounts are integer paise. Rupees only appear at the edges (UPI link, display).

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);

// UPI "am" wants rupees with up to two decimals.
export function paiseToUpiAmount(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`;
}

// 120000 -> "1,20,000" (Indian grouping)
export function formatInr(paise: number): string {
  const rupees = Math.round(paise / 100);
  return `₹${new Intl.NumberFormat('en-IN').format(rupees)}`;
}
