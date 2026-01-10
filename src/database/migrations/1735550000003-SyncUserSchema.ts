import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncSchema1735550000003 implements MigrationInterface {
  name = 'SyncSchema1735550000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ================= USER ENTITY SYNC =================
    // 1. Rank -> UserRank
    const hasRank = await queryRunner.hasColumn('users', 'rank');
    const hasUserRank = await queryRunner.hasColumn('users', 'user_rank');
    if (hasRank && !hasUserRank) {
      await queryRunner.renameColumn('users', 'rank', 'user_rank');
    } else if (!hasRank && !hasUserRank) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "user_rank" integer DEFAULT 0`,
      );
    }

    // 2. GithubUrl -> GithubUsername
    const hasGithubUrl = await queryRunner.hasColumn('users', 'github_url');
    const hasGithubUsername = await queryRunner.hasColumn(
      'users',
      'github_username',
    );
    if (hasGithubUrl && !hasGithubUsername) {
      await queryRunner.renameColumn('users', 'github_url', 'github_username');
    } else if (!hasGithubUrl && !hasGithubUsername) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "github_username" VARCHAR(100)`,
      );
    }

    // 3. Fallback checks for Avatar, Address, Phone
    const hasAvatarUrl = await queryRunner.hasColumn('users', 'avatar_url');
    const hasAvatarKey = await queryRunner.hasColumn('users', 'avatar_key');
    if (hasAvatarUrl && !hasAvatarKey)
      await queryRunner.renameColumn('users', 'avatar_url', 'avatar_key');

    const hasLocation = await queryRunner.hasColumn('users', 'location');
    const hasAddress = await queryRunner.hasColumn('users', 'address');
    if (hasLocation && !hasAddress)
      await queryRunner.renameColumn('users', 'location', 'address');

    const hasPhone = await queryRunner.hasColumn('users', 'phone');
    if (!hasPhone)
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(15)`,
      );

    // ================= TAG ENTITY SYNC =================
    // Missing: type, color, is_active
    const hasTagType = await queryRunner.hasColumn('tags', 'type');
    if (!hasTagType)
      await queryRunner.query(
        `ALTER TABLE "tags" ADD COLUMN "type" VARCHAR(50)`,
      );

    const hasTagColor = await queryRunner.hasColumn('tags', 'color');
    if (!hasTagColor)
      await queryRunner.query(
        `ALTER TABLE "tags" ADD COLUMN "color" VARCHAR(7)`,
      );

    const hasTagIsActive = await queryRunner.hasColumn('tags', 'is_active');
    if (!hasTagIsActive)
      await queryRunner.query(
        `ALTER TABLE "tags" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true`,
      );

    // ================= TOPIC ENTITY SYNC =================
    // Missing: order_index, is_active. Rename: icon -> icon_url
    const hasTopicOrder = await queryRunner.hasColumn('topics', 'order_index');
    if (!hasTopicOrder)
      await queryRunner.query(
        `ALTER TABLE "topics" ADD COLUMN "order_index" INTEGER NOT NULL DEFAULT 0`,
      );

    const hasTopicIsActive = await queryRunner.hasColumn('topics', 'is_active');
    if (!hasTopicIsActive)
      await queryRunner.query(
        `ALTER TABLE "topics" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true`,
      );

    const hasTopicIcon = await queryRunner.hasColumn('topics', 'icon');
    const hasTopicIconUrl = await queryRunner.hasColumn('topics', 'icon_url');
    if (hasTopicIcon && !hasTopicIconUrl) {
      await queryRunner.renameColumn('topics', 'icon', 'icon_url');
      // Alter type to TEXT to match entity
      await queryRunner.query(
        `ALTER TABLE "topics" ALTER COLUMN "icon_url" TYPE TEXT`,
      );
    } else if (!hasTopicIcon && !hasTopicIconUrl) {
      await queryRunner.query(
        `ALTER TABLE "topics" ADD COLUMN "icon_url" TEXT`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse Topic
    if (await queryRunner.hasColumn('topics', 'icon_url'))
      await queryRunner.renameColumn('topics', 'icon_url', 'icon');
    if (await queryRunner.hasColumn('topics', 'is_active'))
      await queryRunner.dropColumn('topics', 'is_active');
    if (await queryRunner.hasColumn('topics', 'order_index'))
      await queryRunner.dropColumn('topics', 'order_index');

    // Reverse Tag
    if (await queryRunner.hasColumn('tags', 'is_active'))
      await queryRunner.dropColumn('tags', 'is_active');
    if (await queryRunner.hasColumn('tags', 'color'))
      await queryRunner.dropColumn('tags', 'color');
    if (await queryRunner.hasColumn('tags', 'type'))
      await queryRunner.dropColumn('tags', 'type');

    // Reverse User (Rank only, Github strict revert might be unsafe if data changed, but basic revert here)
    if (await queryRunner.hasColumn('users', 'user_rank'))
      await queryRunner.renameColumn('users', 'user_rank', 'rank');
    if (await queryRunner.hasColumn('users', 'github_username'))
      await queryRunner.renameColumn('users', 'github_username', 'github_url');
  }
}
