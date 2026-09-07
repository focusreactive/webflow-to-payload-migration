const HARNESS_FS_ROUTE = "/@fs";
const REPLAY_ASSET_ROUTE = /\/a\/[0-9a-f]{16}\b/;

export interface DeclaredField {
  name: string;
}

export function unrenderedFieldWarnings(component: string, fields: readonly DeclaredField[]): string[] {
  return fields
    .filter((field) => !component.includes(field.name))
    .map(
      (field) =>
        `Component.tsx never references its own declared field "${field.name}" — render it from props `
        + `instead of hardcoding lookalike content; the resolved value is already in input.json.`,
    );
}

export function harnessOnlyAssetWarnings(component: string): string[] {
  const warnings: string[] = [];
  if (component.includes(HARNESS_FS_ROUTE)) {
    warnings.push(
      `Component.tsx hardcodes a "${HARNESS_FS_ROUTE}" path — that route is the harness's own dev-time `
        + `filesystem route and does not exist in the deployed app. Render the media from its prop `
        + `(input.json already resolved it) instead of pasting the resolved src.`,
    );
  }
  if (REPLAY_ASSET_ROUTE.test(component)) {
    warnings.push(
      `Component.tsx hardcodes a replay asset path ("/a/<id>") — that route belongs to the reference `
        + `server, not to the candidate. Declare the media as a field so input.json resolves it.`,
    );
  }
  return warnings;
}

export function componentGuardrailWarnings(component: string, fields: readonly DeclaredField[]): string[] {
  return [...harnessOnlyAssetWarnings(component), ...unrenderedFieldWarnings(component, fields)];
}
