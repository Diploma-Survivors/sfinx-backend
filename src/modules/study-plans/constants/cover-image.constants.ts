export const COVER_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export const ALLOWED_COVER_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_COVER_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
