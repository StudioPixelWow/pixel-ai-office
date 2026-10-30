// Approximate list prices (USD per 1M tokens) so budgets and /usage are not stuck at $0.
// Override any rate in Vercel with PRICE_TABLE='{"opus":[5,25],"sonnet":[3,15]}'. Stored as cost_kind 'estimate'.
const DEFAULT: Record<string, [number, number]> = { opus: [5, 25], sonnet: [3, 15], haiku: [1, 5], fable: [10, 50], 'gpt-5': [1.25, 10], 'gpt-4o': [2.5, 10], 'o3': [2, 8], 'o4': [1.1, 4.4] };
let table: Record<string, [number, number]> | null = null;
function rates() { if (!table) { try { table = { ...DEFAULT, ...JSON.parse(process.env.PRICE_TABLE ?? '{}') }; } catch { table = DEFAULT; } } return table!; }
export function tokenCost(model: string | undefined, input: number, output: number, searches = 0) {
  const m = String(model ?? '').toLowerCase(); const k = Object.keys(rates()).find((x) => m.includes(x)); if (!k) return null;
  const [i, o] = rates()[k]; return Math.round(((input / 1e6) * i + (output / 1e6) * o + searches * 0.01) * 10000) / 10000;
}
export const IMAGE_COST = () => Number(process.env.PRICE_IMAGE ?? 0.07);
