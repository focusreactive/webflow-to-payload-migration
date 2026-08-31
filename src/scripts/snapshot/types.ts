export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StyleEntry {
  props: Record<string, string>;
  rects: Record<string, Rect>;
}

export interface CaptureViewport {
  width: number;
  height: number;
  deviceScaleFactor: number;
}

export interface CaptureStabilization {
  freezeMotion: boolean;
  neutralizeSticky: boolean;
  preScrollRemeasure: boolean;
}

export type StickyPosition = "fixed" | "sticky";

export interface StickyMeasurement {
  migId: string;
  position: StickyPosition;
  rect: Rect;
}

export interface StitchedCapture {
  buffer: Buffer;
  doc: { width: number; height: number };
  dpr: number;
  pixels: { width: number; height: number };
  stickyRegions: { migId: string; rect: Rect }[];
}

export interface RenderedPage {
  renderedHtml: string;
  styles: Record<string, StyleEntry>;
  stitches: Record<string, StitchedCapture>;
  networkUrls: string[];
}

export interface BrowserDriver {
  render(opts: {
    url: string;
    viewports: Record<string, CaptureViewport>;
    settleMs: number;
    stabilize: CaptureStabilization;
  }): Promise<RenderedPage>;
  close(): Promise<void>;
}

export interface CollectedFontFace {
  family: string;
  weight?: string;
  style?: "normal" | "italic";
  unicodeRange?: string;
  binaryUrl: string;
}
