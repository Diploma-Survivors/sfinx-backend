import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorUserStatistics1768109335184 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_statistics" (
        "user_id" integer NOT NULL, 
        "global_score" numeric(10,2) NOT NULL DEFAULT '0', 
        "total_solved" integer NOT NULL DEFAULT '0', 
        "total_attempts" integer NOT NULL DEFAULT '0', 
        "solved_easy" integer NOT NULL DEFAULT '0', 
        "solved_medium" integer NOT NULL DEFAULT '0', 
        "solved_hard" integer NOT NULL DEFAULT '0', 
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), 
        CONSTRAINT "PK_user_statistics_user_id" PRIMARY KEY ("user_id"), 
        CONSTRAINT "FK_user_statistics_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )`,
    );

    // Copy data from users to user_statistics
    await queryRunner.query(
      `INSERT INTO "user_statistics" ("user_id", "global_score", "solved_easy", "solved_medium", "solved_hard") 
       SELECT "id", "global_score", "solved_easy", "solved_medium", "solved_hard" FROM "users"`,
    );

    // Calculate total_solved
    await queryRunner.query(
      `UPDATE "user_statistics" SET "total_solved" = "solved_easy" + "solved_medium" + "solved_hard"`,
    );

    // Drop columns from users
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "global_score"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "solved_easy"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "solved_medium"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "solved_hard"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add columns back to users
    await queryRunner.query(
      `ALTER TABLE "users" ADD "solved_hard" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "solved_medium" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "solved_easy" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "global_score" numeric(10,2) NOT NULL DEFAULT '0'`,
    );

    // Restore data from user_statistics
    await queryRunner.query(
      `UPDATE "users" u SET 
        "global_score" = us."global_score",
        "solved_easy" = us."solved_easy",
        "solved_medium" = us."solved_medium",
        "solved_hard" = us."solved_hard"
       FROM "user_statistics" us
       WHERE u."id" = us."user_id"`,
    );

    await queryRunner.query(`DROP TABLE "user_statistics"`);
  }
}
