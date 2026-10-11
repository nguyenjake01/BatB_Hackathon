// Mock/real switch for every integration module.
//
// USE_MOCKS=true (the default) uses mocks everywhere. USE_MOCKS=false uses real
// integrations everywhere. A per-module flag such as USE_MOCKS_SUPPLY=false
// overrides the global flag for that module, so each owner can test their real
// integration while the rest of the app stays on mocks.

export type IntegrationModule = "supply" | "agent" | "payments" | "square";

function parseFlag(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  return value.trim().toLowerCase() !== "false";
}

export function isMockMode(module?: IntegrationModule): boolean {
  if (module) {
    const override = parseFlag(process.env[`USE_MOCKS_${module.toUpperCase()}`]);
    if (override !== undefined) return override;
  }
  return parseFlag(process.env.USE_MOCKS) ?? true;
}

export class NotImplementedError extends Error {
  constructor(what: string, module: IntegrationModule) {
    super(
      `${what} is not implemented yet. Set USE_MOCKS=true or USE_MOCKS_${module.toUpperCase()}=true to use the mock.`,
    );
    this.name = "NotImplementedError";
  }
}
