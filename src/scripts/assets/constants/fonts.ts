export const DEFAULT_WEIGHT = "400";

export const WEIGHT_NAME_TO_VALUE: Record<string, string> = {
  thin: "100",
  extralight: "200",
  ultralight: "200",
  light: "300",
  regular: "400",
  normal: "400",
  book: "400",
  medium: "500",
  semibold: "600",
  demibold: "600",
  bold: "700",
  extrabold: "800",
  ultrabold: "800",
  black: "900",
  heavy: "900",
};

export const FONT_FACE_BLOCK_PATTERN = /@font-face\s*\{([^}]*)\}/gi;
