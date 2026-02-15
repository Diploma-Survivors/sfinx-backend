import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInterviewEvaluationTable1771075200439 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "ai_interview_evaluations" (
                "id"                     uuid          NOT NULL DEFAULT gen_random_uuid(),
                "interview_id"           uuid          NOT NULL,
                "problem_solving_score"  float         NOT NULL DEFAULT 0,
                "code_quality_score"     float         NOT NULL DEFAULT 0,
                "communication_score"    float         NOT NULL DEFAULT 0,
                "technical_score"        float         NOT NULL DEFAULT 0,
                "overall_score"          float         NOT NULL DEFAULT 0,
                "strengths"              jsonb         NOT NULL DEFAULT '[]',
                "improvements"           jsonb         NOT NULL DEFAULT '[]',
                "detailed_feedback"      text          NOT NULL,
                "created_at"             timestamptz   NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ai_interview_evaluations" PRIMARY KEY ("id")
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_interview_evaluations"`);
  }
}
