import { StorageService } from '../../modules/storage/storage.service';

/**
 * Transform avatar key to full URL
 * Handles both S3 keys and existing full URLs
 */
export function getAvatarUrl(
  avatarKey: string | null | undefined,
  storageService: StorageService,
): string | null {
  if (!avatarKey) return null;

  // If already a full URL, return as-is
  if (avatarKey.startsWith('http://') || avatarKey.startsWith('https://')) {
    return avatarKey;
  }

  // Transform S3 key to CloudFront URL
  return storageService.getCloudFrontUrl(avatarKey);
}
