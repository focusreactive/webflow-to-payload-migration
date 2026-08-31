export function instanceKey(route: string, nodeIds: string[]): string {
  return `${route}::${nodeIds[0]}`;
}
