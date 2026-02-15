import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncUserSchema1771072159836 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop columns removed from entity
    const colsToDrop = [
      'company',
      'email_verified_at',
      'oauth_provider',
      'oauth_provider_id',
      'github_id',
      'user_rank',
    ];
    for (const col of colsToDrop) {
      if (await queryRunner.hasColumn('users', col)) {
        await queryRunner.dropColumn('users', col);
      }
    }

    // Rename premium date columns
    const hasPremiumStartDate = await queryRunner.hasColumn(
      'users',
      'premium_start_date',
    );
    const hasPremiumStartedAt = await queryRunner.hasColumn(
      'users',
      'premium_started_at',
    );
    if (hasPremiumStartDate && !hasPremiumStartedAt) {
      await queryRunner.renameColumn(
        'users',
        'premium_start_date',
        'premium_started_at',
      );
    }

    const hasPremiumEndDate = await queryRunner.hasColumn(
      'users',
      'premium_end_date',
    );
    const hasPremiumExpiresAt = await queryRunner.hasColumn(
      'users',
      'premium_expires_at',
    );
    if (hasPremiumEndDate && !hasPremiumExpiresAt) {
      await queryRunner.renameColumn(
        'users',
        'premium_end_date',
        'premium_expires_at',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse premium renames
    if (await queryRunner.hasColumn('users', 'premium_started_at'))
      await queryRunner.renameColumn(
        'users',
        'premium_started_at',
        'premium_start_date',
      );
    if (await queryRunner.hasColumn('users', 'premium_expires_at'))
      await queryRunner.renameColumn(
        'users',
        'premium_expires_at',
        'premium_end_date',
      );

    // Re-add dropped columns
    if (!(await queryRunner.hasColumn('users', 'user_rank')))
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "user_rank" integer DEFAULT 0`,
      );
    if (!(await queryRunner.hasColumn('users', 'company')))
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "company" character varying`,
      );
    if (!(await queryRunner.hasColumn('users', 'email_verified_at')))
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamptz`,
      );
    if (!(await queryRunner.hasColumn('users', 'oauth_provider')))
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "oauth_provider" character varying`,
      );
    if (!(await queryRunner.hasColumn('users', 'oauth_provider_id')))
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "oauth_provider_id" character varying`,
      );
    if (!(await queryRunner.hasColumn('users', 'github_id')))
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "github_id" character varying`,
      );
  }
}
