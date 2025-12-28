import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveJudge0TokenColumn1735300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('submissions', 'judge0_token');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'submissions',
      new TableColumn({
        name: 'judge0_token',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }
}
