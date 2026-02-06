// Avatar upload constants
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const AVATAR_UPLOAD_URL_EXPIRES_IN = 900; // 15 minutes
export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const ALLOWED_AVATAR_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
] as const;

export const DEFAULT_AVATAR_URL =
  'https://cdn.pixabay.com/photo/2018/11/13/21/43/avatar-3814049_1280.png';
