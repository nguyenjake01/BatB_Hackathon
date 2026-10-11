// Shared class names so every page uses the same buttons, inputs and pills.

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const button = {
  /** Main action on a panel (save, claim). */
  primary: `${buttonBase} bg-stone-900 text-white shadow-sm hover:bg-stone-700`,
  /** The agent's own actions (run agent). */
  agent: `${buttonBase} bg-amber-600 text-white shadow-sm hover:bg-amber-700`,
  /** Spending money. */
  pay: `${buttonBase} bg-emerald-600 text-white shadow-sm hover:bg-emerald-700`,
  secondary: `${buttonBase} border border-line bg-white text-stone-700 shadow-sm hover:bg-stone-50`,
  ghost: `${buttonBase} text-stone-600 hover:bg-stone-100`,
  link: "text-sm font-medium text-amber-700 hover:text-amber-800 hover:underline",
};

export const input =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-stone-900 shadow-sm placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:bg-stone-50 disabled:text-stone-500";

export const label = "mb-1 block text-sm font-medium text-stone-700";

const pillBase = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

export const pill = {
  red: `${pillBase} bg-red-50 text-red-700 ring-1 ring-inset ring-red-200`,
  amber: `${pillBase} bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200`,
  green: `${pillBase} bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200`,
  blue: `${pillBase} bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200`,
  violet: `${pillBase} bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200`,
  gray: `${pillBase} bg-stone-100 text-stone-600 ring-1 ring-inset ring-stone-200`,
};
