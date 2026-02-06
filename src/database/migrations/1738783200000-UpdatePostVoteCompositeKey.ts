import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePostVoteCompositeKey1738783200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing primary key constraint
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP CONSTRAINT IF EXISTS "discuss_post_votes_pkey"`,
    );

    // Drop the id column
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP COLUMN IF EXISTS "id"`,
    );

    // Drop the unique constraint (if exists)
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP CONSTRAINT IF EXISTS "UQ_discuss_post_votes_user_post"`,
    );

    // Add composite primary key
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" ADD CONSTRAINT "discuss_post_votes_pkey" PRIMARY KEY ("user_id", "post_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite primary key
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP CONSTRAINT "discuss_post_votes_pkey"`,
    );

    // Add back id column
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" ADD COLUMN "id" SERIAL PRIMARY KEY`,
    );

    // Add back unique constraint
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" ADD CONSTRAINT "UQ_discuss_post_votes_user_post" UNIQUE ("user_id", "post_id")`,
    );
  }
}
