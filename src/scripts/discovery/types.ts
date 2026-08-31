export interface AcceptError {
  code: string;
  where: string;
  got?: string;
  detail?: string;
  fix: string;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DedupSubjectEntry {
  route: string;
  nodeIds: string[];
  role: string;
  summary: string;
  rectsByViewport: Record<string, Rect>;
}

export interface DedupSubject {
  instances: DedupSubjectEntry[];
}
