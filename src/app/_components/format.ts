export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

export const qty = (n: number, unit: string) => (unit === "each" ? num(n) : `${num(n)} ${unit}`);

export const shortHash = (hash: string) => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
