import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateProblemReportsTable1772021468643 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "problem_report_type_enum" AS ENUM ('WRONG_DESCRIPTION', 'WRONG_ANSWER', 'WRONG_TEST_CASE', 'OTHER')`,
    );

    await queryRunner.query(
      `CREATE TYPE "problem_report_status_enum" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'problem_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'type',
            type: 'problem_report_type_enum',
          },
          {
            name: 'description',
            type: 'text',
          },
          {
            name: 'status',
            type: 'problem_report_status_enum',
            default: `'PENDING'`,
          },
          {
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'problem_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'problem_reports',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.createForeignKey(
      'problem_reports',
      new TableForeignKey({
        columnNames: ['problem_id'],
        referencedTableName: 'problems',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('problem_reports');
    if (table) {
      for (const fk of table.foreignKeys) {
        await queryRunner.dropForeignKey('problem_reports', fk);
      }
    }

    await queryRunner.dropTable('problem_reports', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "problem_report_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "problem_report_type_enum"`);
  }
}
