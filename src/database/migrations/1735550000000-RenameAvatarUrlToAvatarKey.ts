import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameAvatarUrlToAvatarKey1735550000000 implements MigrationInterface {
  name = 'RenameAvatarUrlToAvatarKey1735550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename column from avatar_url to avatar_key
    await queryRunner.query(`
      ALTER TABLE "users"
      RENAME COLUMN "avatar_url" TO "avatar_key"
    `);

    // Update comment to reflect that it stores S3 keys
    await queryRunner.query(`
      COMMENT ON COLUMN "users"."avatar_key" IS 'S3 key for user avatar (e.g., avatars/123/1735500000.jpg)'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      RENAME COLUMN "avatar_key" TO "avatar_url"
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN "users"."avatar_url" IS NULL
    `);
  }
}
