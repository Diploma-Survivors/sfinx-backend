import { extname } from 'node:path';

import { BadRequestException } from '@nestjs/common';
import { FileInterceptor as FileIn } from '@nestjs/platform-express';

import { diskStorage } from 'multer';
import { v4 as uuidV4 } from 'uuid';

import {
  TESTCASE_DESTINATION_FOLDER,
  TESTCASE_FILE_FIELD_NAME,
  TESTCASE_FILE_MIME_TYPE,
  TESTCASE_MAX_FILE_SIZE,
} from 'src/common';

export function FileInterceptor(
  fieldName: string = TESTCASE_FILE_FIELD_NAME,
  maxFileSize: number = TESTCASE_MAX_FILE_SIZE,
  mimeType: string = TESTCASE_FILE_MIME_TYPE,
) {
  return FileIn(fieldName, {
    storage: diskStorage({
      destination: TESTCASE_DESTINATION_FOLDER,
      filename: (_req, file, callback) => {
        const uniqueSuffix = `${Date.now()}-${uuidV4()}`;
        callback(null, `testcase-${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
    limits: {
      fileSize: maxFileSize,
    },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== mimeType) {
        return cb(
          new BadRequestException(
            `Invalid file type. Expected ${mimeType} but received ${file.mimetype}`,
          ),
          false,
        );
      }

      return cb(null, true);
    },
  });
}
