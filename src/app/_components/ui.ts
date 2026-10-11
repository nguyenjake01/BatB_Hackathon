// Shared class names so every page uses the same buttons, inputs and pills.

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40";

export const button = {
  /** Main action on a panel (save, claim). */
  primary: `${buttonBase} bg-stone-800 text-white hover:bg-stone-900`,
  /** The agent's own actions (run agent). */
  agent: `${buttonBase} bg-accent text-white hover:bg-accent-strong`,
  /** Spending money. */
  pay: `${buttonBase} bg-emerald-600 text-white hover:bg-emerald-700`,
  secondary: `${buttonBase} bg-white text-stone-900 ring-1 ring-inset ring-line hover:bg-stone-50`,
  ghost: `${buttonBase} text-stone-600 hover:bg-black/5 hover:text-stone-900`,
  link: "text-sm font-semibold text-accent hover:text-accent-strong hover:underline",
};

export const input =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:bg-stone-50 disabled:text-stone-500";

export const label = "mb-1 block text-sm font-medium text-stone-700";

const pillBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

export const pill = {
  red: `${pillBase} bg-red-50 text-red-700`,
  amber: `${pillBase} bg-amber-50 text-amber-800`,
  green: `${pillBase} bg-emerald-50 text-emerald-700`,
  blue: `${pillBase} bg-accent/10 text-accent-strong`,
  violet: `${pillBase} bg-violet-50 text-violet-700`,
  gray: `${pillBase} bg-white text-stone-600 ring-1 ring-inset ring-line`,
};
