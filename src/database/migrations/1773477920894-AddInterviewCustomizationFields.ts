import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInterviewCustomizationFields1773477920894 implements MigrationInterface {
  name = 'AddInterviewCustomizationFields1773477920894';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types
    await queryRunner.query(
      `CREATE TYPE "public"."ai_interviews_interview_mode_enum" AS ENUM('30min', '45min', '60min')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ai_interviews_interview_difficulty_enum" AS ENUM('entry', 'experienced', 'senior')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ai_interviews_interviewer_personality_enum" AS ENUM('easy_going', 'strict', 'jackass')`,
    );

    // Add columns to ai_interviews table
    await queryRunner.query(
      `ALTER TABLE "ai_interviews" ADD "interview_mode" "public"."ai_interviews_interview_mode_enum" NOT NULL DEFAULT '45min'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_interviews" ADD "interview_difficulty" "public"."ai_interviews_interview_difficulty_enum" NOT NULL DEFAULT 'entry'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_interviews" ADD "interviewer_personality" "public"."ai_interviews_interviewer_personality_enum" NOT NULL DEFAULT 'easy_going'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns
    await queryRunner.query(
      `ALTER TABLE "ai_interviews" DROP COLUMN "interviewer_personality"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_interviews" DROP COLUMN "interview_difficulty"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_interviews" DROP COLUMN "interview_mode"`,
    );

    // Drop enum types
    await queryRunner.query(
      `DROP TYPE "public"."ai_interviews_interviewer_personality_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."ai_interviews_interview_difficulty_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."ai_interviews_interview_mode_enum"`,
    );
  }
}
