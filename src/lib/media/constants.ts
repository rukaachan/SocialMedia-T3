export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export const MAX_MEDIA_DIMENSION = 8192;
export const MAX_MEDIA_PIXELS = 25_000_000;
export const MAX_CLIENT_MEDIA_DIMENSION = 1600;
export const MAX_ALT_TEXT_LENGTH = 200;

export const MEDIA_PURPOSES = ["avatar", "post"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];
