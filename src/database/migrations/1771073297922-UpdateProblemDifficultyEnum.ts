import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateProblemDifficultyEnum1771073297922 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Detach column from enum to allow data + type changes
    await queryRunner.query(
      `ALTER TABLE "problems" ALTER COLUMN "difficulty" TYPE text`,
    );

    // Step 2: Normalise existing values to lowercase
    await queryRunner.query(
      `UPDATE "problems" SET "difficulty" = LOWER("difficulty")`,
    );

    // Step 3: Recreate enum with lowercase values matching ProblemDifficulty
    await queryRunner.query(`DROP TYPE IF EXISTS "problems_difficulty_enum"`);
    await queryRunner.query(
      `CREATE TYPE "problems_difficulty_enum" AS ENUM ('easy', 'medium', 'hard')`,
    );

    // Step 4: Re-attach column to the new enum type
    await queryRunner.query(
      `ALTER TABLE "problems"
                ALTER COLUMN "difficulty" TYPE "problems_difficulty_enum"
                USING "difficulty"::"problems_difficulty_enum"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Detach
    await queryRunner.query(
      `ALTER TABLE "problems" ALTER COLUMN "difficulty" TYPE text`,
    );

    // Step 2: Restore to uppercase
    await queryRunner.query(
      `UPDATE "problems" SET "difficulty" = UPPER("difficulty")`,
    );

    // Step 3: Recreate enum with uppercase values
    await queryRunner.query(`DROP TYPE IF EXISTS "problems_difficulty_enum"`);
    await queryRunner.query(
      `CREATE TYPE "problems_difficulty_enum" AS ENUM ('EASY', 'MEDIUM', 'HARD')`,
    );

    // Step 4: Re-attach
    await queryRunner.query(
      `ALTER TABLE "problems"
                ALTER COLUMN "difficulty" TYPE "problems_difficulty_enum"
                USING "difficulty"::"problems_difficulty_enum"`,
    );
  }
}
