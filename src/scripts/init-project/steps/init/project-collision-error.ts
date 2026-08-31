export class ProjectCollisionError extends Error {
  constructor(opts: { projectPath: string; sourceUrl: string; occupiedBy: string | null }) {
    const owner = opts.occupiedBy === null ? "a folder with no readable manifest" : opts.occupiedBy;
    super(
      `${opts.projectPath} is taken by ${owner}, not by ${opts.sourceUrl}. `
        + `Re-run --prepare with a different --project-name or --workspace-path.`,
    );
    this.name = "ProjectCollisionError";
  }
}
