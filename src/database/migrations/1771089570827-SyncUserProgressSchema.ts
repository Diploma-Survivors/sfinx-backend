import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SyncUserProgressSchema1771089570827 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_problem_progress');

    // 1. Convert best_runtime_ms to double precision
    const runtimeCol = table?.findColumnByName('best_runtime_ms');
    if (runtimeCol && runtimeCol.type !== 'double precision') {
      await queryRunner.changeColumn(
        'user_problem_progress',
        'best_runtime_ms',
        new TableColumn({
          name: 'best_runtime_ms',
          type: 'double precision',
          isNullable: true,
        }),
      );
    }

    // 2. Convert best_memory_kb to double precision
    const memoryCol = table?.findColumnByName('best_memory_kb');
    if (memoryCol && memoryCol.type !== 'double precision') {
      await queryRunner.changeColumn(
        'user_problem_progress',
        'best_memory_kb',
        new TableColumn({
          name: 'best_memory_kb',
          type: 'double precision',
          isNullable: true,
        }),
      );
    }

    // 3. Ensure status enum type exists with correct values
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const enumExists: Array<unknown> = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'user_problem_progress_status_enum'`,
    );

    if (enumExists.length === 0) {
      await queryRunner.query(
        `CREATE TYPE "user_problem_progress_status_enum" AS ENUM ('attempted', 'solved', 'not-started')`,
      );
    }

    // 4. Convert status column to the enum type
    // Must drop the DEFAULT first, then alter type, then restore DEFAULT
    // (PostgreSQL cannot cast string defaults to enum type automatically)
    const statusCol = table?.findColumnByName('status');
    if (statusCol && statusCol.type !== 'user_problem_progress_status_enum') {
      await queryRunner.query(
        `ALTER TABLE "user_problem_progress" ALTER COLUMN "status" DROP DEFAULT`,
      );
      await queryRunner.query(
        `ALTER TABLE "user_problem_progress"
         ALTER COLUMN "status" TYPE "user_problem_progress_status_enum"
         USING "status"::text::"user_problem_progress_status_enum"`,
      );
      await queryRunner.query(
        `ALTER TABLE "user_problem_progress"
         ALTER COLUMN "status" SET DEFAULT 'attempted'::"user_problem_progress_status_enum"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert status to varchar
    await queryRunner.query(
      `ALTER TABLE "user_problem_progress"
       ALTER COLUMN "status" TYPE varchar USING "status"::text`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "user_problem_progress_status_enum"`,
    );

    // Revert float columns to real (float4)
    await queryRunner.changeColumn(
      'user_problem_progress',
      'best_runtime_ms',
      new TableColumn({
        name: 'best_runtime_ms',
        type: 'real',
        isNullable: true,
      }),
    );

    await queryRunner.changeColumn(
      'user_problem_progress',
      'best_memory_kb',
      new TableColumn({
        name: 'best_memory_kb',
        type: 'real',
        isNullable: true,
      }),
    );
  }
}
