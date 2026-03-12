import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ALLOWED_COVER_IMAGE_MIME_TYPES,
  COVER_IMAGE_MAX_SIZE_BYTES,
} from '../constants/cover-image.constants';

export function CoverImageInterceptor() {
  return FileInterceptor('coverImage', {
    limits: {
      fileSize: COVER_IMAGE_MAX_SIZE_BYTES,
    },
    fileFilter: (_req, file, cb) => {
      if (
        !ALLOWED_COVER_IMAGE_MIME_TYPES.includes(
          file.mimetype as (typeof ALLOWED_COVER_IMAGE_MIME_TYPES)[number],
        )
      ) {
        return cb(
          new BadRequestException(
            `Invalid file type "${file.mimetype}". Allowed: ${ALLOWED_COVER_IMAGE_MIME_TYPES.join(', ')}`,
          ),
          false,
        );
      }

      return cb(null, true);
    },
  });
}
