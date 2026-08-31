export const ASSETS_STEP_PREFIX = "assets";

export const ASSETS_MEDIA_STEP_ID = `${ASSETS_STEP_PREFIX}:media` as const;
export const ASSETS_FONTS_STEP_ID = `${ASSETS_STEP_PREFIX}:fonts` as const;

export const ASSETS_STEP_IDS = [ASSETS_MEDIA_STEP_ID, ASSETS_FONTS_STEP_ID] as const;
