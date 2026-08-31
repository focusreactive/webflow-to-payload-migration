export interface ProbeHttpSnapshot {
  status: number;
  finalUrl: string;
  redirectChain: string[];
  headers: Record<string, string>;
}
