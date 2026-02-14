import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInterviewMessageTable1771075220557 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // FK to ai_interviews is added in CreateInterviewTable migration (runs after this one)
    await queryRunner.query(
      `CREATE TYPE "ai_interview_messages_role_enum" AS ENUM ('user', 'assistant', 'system')`,
    );
    await queryRunner.query(`
            CREATE TABLE "ai_interview_messages" (
                "id"           uuid                                NOT NULL DEFAULT gen_random_uuid(),
                "interview_id" uuid                                NOT NULL,
                "role"         "ai_interview_messages_role_enum"   NOT NULL,
                "content"      text                                NOT NULL,
                "created_at"   timestamptz                         NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ai_interview_messages" PRIMARY KEY ("id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_interview_messages"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "ai_interview_messages_role_enum"`,
    );
  }
}
