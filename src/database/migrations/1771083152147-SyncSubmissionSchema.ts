import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncSubmissionSchema1771083152147 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('submissions', 'runtime_ms')) {
      await queryRunner.query(
        `ALTER TABLE "submissions" ALTER COLUMN "runtime_ms" TYPE double precision`,
      );
    }
    if (await queryRunner.hasColumn('submissions', 'memory_kb')) {
      await queryRunner.query(
        `ALTER TABLE "submissions" ALTER COLUMN "memory_kb" TYPE double precision`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('submissions', 'runtime_ms')) {
      await queryRunner.query(
        `ALTER TABLE "submissions" ALTER COLUMN "runtime_ms" TYPE integer USING runtime_ms::integer`,
      );
    }
    if (await queryRunner.hasColumn('submissions', 'memory_kb')) {
      await queryRunner.query(
        `ALTER TABLE "submissions" ALTER COLUMN "memory_kb" TYPE integer USING memory_kb::integer`,
      );
    }
  }
}
