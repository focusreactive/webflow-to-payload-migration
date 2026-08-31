export const NETWORK_IDLE_TIMEOUT_MS = 5000;
export const CAPTURE_OVERLAP_FRACTION = 0.125;
export const PRE_SCROLL_STEP_DELAY_MS = 100;
export const PRE_SCROLL_MAX_STEPS = 100;
export const SETTLE_MAX_WAIT_MS = 5000;
export const SETTLE_STABLE_FRAMES = 5;
export const SCROLL_TOP_SETTLE_MS = 1000;
export const SCROLL_TOP_STABLE_FRAMES = 2;
export const STRIP_SETTLE_MAX_MS = 1500;
export const STRIP_SETTLE_STABLE_FRAMES = 2;

export const HIDDEN_ATTRIBUTE = "data-mig-hidden";
export const HIDDEN_STYLE_ID = "mig-hidden-elements";
export const HIDDEN_STYLE_CSS = `[${HIDDEN_ATTRIBUTE}="1"], [${HIDDEN_ATTRIBUTE}="1"] * { visibility: hidden !important; }`;
