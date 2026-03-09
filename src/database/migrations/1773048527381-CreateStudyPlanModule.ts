import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStudyPlanModule1773048527381 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enums
    await queryRunner.query(
      `CREATE TYPE "study_plan_difficulty_enum" AS ENUM ('beginner', 'intermediate', 'advanced')`,
    );
    await queryRunner.query(
      `CREATE TYPE "study_plan_status_enum" AS ENUM ('draft', 'published', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "enrollment_status_enum" AS ENUM ('active', 'completed', 'abandoned')`,
    );

    // study_plans table
    await queryRunner.query(`
      CREATE TABLE "study_plans" (
        "id" SERIAL NOT NULL,
        "slug" character varying(255) NOT NULL,
        "difficulty" "study_plan_difficulty_enum" NOT NULL DEFAULT 'beginner',
        "status" "study_plan_status_enum" NOT NULL DEFAULT 'draft',
        "estimated_days" integer NOT NULL,
        "cover_image_key" text,
        "is_premium" boolean NOT NULL DEFAULT false,
        "enrollment_count" integer NOT NULL DEFAULT 0,
        "similar_plan_ids" INTEGER[] NOT NULL DEFAULT '{}',
        "created_by" integer,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_study_plans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_study_plans_slug" UNIQUE ("slug")
      )
    `);

    // study_plan_translations table
    await queryRunner.query(`
      CREATE TABLE "study_plan_translations" (
        "id" SERIAL NOT NULL,
        "study_plan_id" integer NOT NULL,
        "language_code" character varying(10) NOT NULL,
        "name" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_study_plan_translations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_study_plan_translations_plan_lang" UNIQUE ("study_plan_id", "language_code")
      )
    `);

    // study_plan_items table
    await queryRunner.query(`
      CREATE TABLE "study_plan_items" (
        "id" SERIAL NOT NULL,
        "study_plan_id" integer NOT NULL,
        "problem_id" integer NOT NULL,
        "day_number" integer NOT NULL,
        "order_index" integer NOT NULL DEFAULT 0,
        "note" text,
        CONSTRAINT "PK_study_plan_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_study_plan_items_plan_problem" UNIQUE ("study_plan_id", "problem_id")
      )
    `);

    // study_plan_enrollments table
    await queryRunner.query(`
      CREATE TABLE "study_plan_enrollments" (
        "study_plan_id" integer NOT NULL,
        "user_id" integer NOT NULL,
        "status" "enrollment_status_enum" NOT NULL DEFAULT 'active',
        "current_day" integer NOT NULL DEFAULT 1,
        "solved_count" integer NOT NULL DEFAULT 0,
        "last_activity_at" TIMESTAMP WITH TIME ZONE,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "enrolled_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_study_plan_enrollments" PRIMARY KEY ("study_plan_id", "user_id")
      )
    `);

    // study_plan_topics join table
    await queryRunner.query(`
      CREATE TABLE "study_plan_topics" (
        "study_plan_id" integer NOT NULL,
        "topic_id" integer NOT NULL,
        CONSTRAINT "PK_study_plan_topics" PRIMARY KEY ("study_plan_id", "topic_id")
      )
    `);

    // study_plan_tags join table
    await queryRunner.query(`
      CREATE TABLE "study_plan_tags" (
        "study_plan_id" integer NOT NULL,
        "tag_id" integer NOT NULL,
        CONSTRAINT "PK_study_plan_tags" PRIMARY KEY ("study_plan_id", "tag_id")
      )
    `);

    // Indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_items_plan_id" ON "study_plan_items" ("study_plan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_items_problem_id" ON "study_plan_items" ("problem_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_items_plan_day" ON "study_plan_items" ("study_plan_id", "day_number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_enrollments_user" ON "study_plan_enrollments" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_topics_plan" ON "study_plan_topics" ("study_plan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_topics_topic" ON "study_plan_topics" ("topic_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_tags_plan" ON "study_plan_tags" ("study_plan_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_plan_tags_tag" ON "study_plan_tags" ("tag_id")`,
    );

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE "study_plans" ADD CONSTRAINT "FK_study_plans_created_by"
        FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_translations" ADD CONSTRAINT "FK_study_plan_translations_plan"
        FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_items" ADD CONSTRAINT "FK_study_plan_items_plan"
        FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_items" ADD CONSTRAINT "FK_study_plan_items_problem"
        FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_enrollments" ADD CONSTRAINT "FK_study_plan_enrollments_plan"
        FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_enrollments" ADD CONSTRAINT "FK_study_plan_enrollments_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_topics" ADD CONSTRAINT "FK_study_plan_topics_plan"
        FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_topics" ADD CONSTRAINT "FK_study_plan_topics_topic"
        FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_tags" ADD CONSTRAINT "FK_study_plan_tags_plan"
        FOREIGN KEY ("study_plan_id") REFERENCES "study_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "study_plan_tags" ADD CONSTRAINT "FK_study_plan_tags_tag"
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Seed RBAC permissions
    await queryRunner.query(`
      INSERT INTO "permissions" ("action", "resource", "description")
      VALUES
        ('create', 'study_plan', 'Create study plans'),
        ('read', 'study_plan', 'Read study plans'),
        ('update', 'study_plan', 'Update study plans'),
        ('delete', 'study_plan', 'Delete study plans')
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove permissions
    await queryRunner.query(
      `DELETE FROM "permissions" WHERE "resource" = 'study_plan'`,
    );

    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "study_plan_tags" DROP CONSTRAINT "FK_study_plan_tags_tag"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_tags" DROP CONSTRAINT "FK_study_plan_tags_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_topics" DROP CONSTRAINT "FK_study_plan_topics_topic"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_topics" DROP CONSTRAINT "FK_study_plan_topics_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_enrollments" DROP CONSTRAINT "FK_study_plan_enrollments_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_enrollments" DROP CONSTRAINT "FK_study_plan_enrollments_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_items" DROP CONSTRAINT "FK_study_plan_items_problem"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_items" DROP CONSTRAINT "FK_study_plan_items_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plan_translations" DROP CONSTRAINT "FK_study_plan_translations_plan"`,
    );
    await queryRunner.query(
      `ALTER TABLE "study_plans" DROP CONSTRAINT "FK_study_plans_created_by"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE "study_plan_tags"`);
    await queryRunner.query(`DROP TABLE "study_plan_topics"`);
    await queryRunner.query(`DROP TABLE "study_plan_enrollments"`);
    await queryRunner.query(`DROP TABLE "study_plan_items"`);
    await queryRunner.query(`DROP TABLE "study_plan_translations"`);
    await queryRunner.query(`DROP TABLE "study_plans"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "enrollment_status_enum"`);
    await queryRunner.query(`DROP TYPE "study_plan_status_enum"`);
    await queryRunner.query(`DROP TYPE "study_plan_difficulty_enum"`);
  }
}
