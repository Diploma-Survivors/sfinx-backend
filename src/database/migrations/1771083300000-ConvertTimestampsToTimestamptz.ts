import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts all plain TIMESTAMP (without time zone) columns to TIMESTAMPTZ
 * across tables created by the initial schema and subsequent migrations.
 */
export class ConvertTimestampsToTimestamptz1771083300000 implements MigrationInterface {
  private readonly conversions: Array<{ table: string; columns: string[] }> = [
    { table: 'permissions', columns: ['created_at', 'updated_at'] },
    { table: 'roles', columns: ['created_at', 'updated_at'] },
    { table: 'users', columns: ['created_at', 'updated_at'] },
    { table: 'refresh_tokens', columns: ['created_at'] },
    { table: 'topics', columns: ['created_at', 'updated_at'] },
    { table: 'tags', columns: ['created_at', 'updated_at'] },
    { table: 'programming_languages', columns: ['created_at', 'updated_at'] },
    { table: 'problems', columns: ['created_at', 'updated_at'] },
    { table: 'sample_testcases', columns: ['created_at', 'updated_at'] },
    { table: 'submissions', columns: ['submitted_at'] },
    { table: 'user_problem_progress', columns: ['first_attempted_at'] },
    { table: 'saved_favorite_lists', columns: ['created_at'] },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, columns } of this.conversions) {
      for (const col of columns) {
        if (await queryRunner.hasColumn(table, col)) {
          await queryRunner.query(
            `ALTER TABLE "${table}" ALTER COLUMN "${col}" TYPE timestamptz`,
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, columns } of this.conversions) {
      for (const col of columns) {
        if (await queryRunner.hasColumn(table, col)) {
          await queryRunner.query(
            `ALTER TABLE "${table}" ALTER COLUMN "${col}" TYPE timestamp without time zone`,
          );
        }
      }
    }
  }
}
