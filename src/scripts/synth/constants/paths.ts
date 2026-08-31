import { join } from "node:path";

import { synthEntryDir, type Vertical } from "#lib/synth-store/paths.ts";

export const SCHEMA_SHARD_FILE = "schema.json";
export const CONTENT_SHARD_FILE = "content.json";
export const INPUT_FILE = "input.json";
export const COMPONENT_FILE = "Component.tsx";
export const RICHTEXT_DIR = "richtext";
export const RESPONSES_DIR = "responses";
export const SECTIONS_DIR = "sections";

export type Judgement = "fields" | "content" | "richtext";

export function sectionDir(projectPath: string, collectionKey: string, sectionId: string): string {
  return join(synthEntryDir(projectPath, "collections", collectionKey), SECTIONS_DIR, sectionId);
}

export function sectionEntityKey(collectionKey: string, sectionId: string): string {
  return join(collectionKey, SECTIONS_DIR, sectionId);
}

export function schemaShardPath(projectPath: string, vertical: Vertical, entityKey: string): string {
  return join(synthEntryDir(projectPath, vertical, entityKey), SCHEMA_SHARD_FILE);
}

export function contentShardPath(projectPath: string, vertical: Vertical, entityKey: string): string {
  return join(synthEntryDir(projectPath, vertical, entityKey), CONTENT_SHARD_FILE);
}

export function inputPath(projectPath: string, vertical: Vertical, entityKey: string): string {
  return join(synthEntryDir(projectPath, vertical, entityKey), INPUT_FILE);
}

export function componentPath(projectPath: string, vertical: Vertical, entityKey: string): string {
  return join(synthEntryDir(projectPath, vertical, entityKey), COMPONENT_FILE);
}

export function responsePath(
  projectPath: string,
  vertical: Vertical,
  entityKey: string,
  judgement: Judgement,
): string {
  return join(synthEntryDir(projectPath, vertical, entityKey), RESPONSES_DIR, `${judgement}.json`);
}
