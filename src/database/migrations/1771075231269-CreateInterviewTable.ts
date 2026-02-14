import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInterviewTable1771075231269 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "ai_interviews_status_enum" AS ENUM ('active', 'completed', 'abandoned')`,
    );
    await queryRunner.query(`
            CREATE TABLE "ai_interviews" (
                "id"               uuid                        NOT NULL DEFAULT gen_random_uuid(),
                "user_id"          integer                     NOT NULL,
                "problem_id"       integer                     NOT NULL,
                "problem_snapshot" jsonb                       NOT NULL,
                "status"           "ai_interviews_status_enum" NOT NULL DEFAULT 'active',
                "started_at"       timestamptz                 NOT NULL DEFAULT now(),
                "ended_at"         timestamptz,
                CONSTRAINT "PK_ai_interviews" PRIMARY KEY ("id"),
                CONSTRAINT "FK_ai_interviews_user" FOREIGN KEY ("user_id")
                    REFERENCES "users" ("id") ON DELETE CASCADE
            )
        `);

    // Add FK constraints to tables created before this one
    await queryRunner.query(`
            ALTER TABLE "ai_interview_messages"
                ADD CONSTRAINT "FK_ai_interview_messages_interview"
                FOREIGN KEY ("interview_id") REFERENCES "ai_interviews" ("id") ON DELETE CASCADE
        `);
    await queryRunner.query(`
            ALTER TABLE "ai_interview_evaluations"
                ADD CONSTRAINT "FK_ai_interview_evaluations_interview"
                FOREIGN KEY ("interview_id") REFERENCES "ai_interviews" ("id") ON DELETE CASCADE
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ai_interview_evaluations" DROP CONSTRAINT IF EXISTS "FK_ai_interview_evaluations_interview"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ai_interview_messages" DROP CONSTRAINT IF EXISTS "FK_ai_interview_messages_interview"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_interviews"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "ai_interviews_status_enum"`);
  }
}
