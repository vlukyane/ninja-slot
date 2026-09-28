export function formatMoney(n: number): string {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatBet(n: number): string {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: n < 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
