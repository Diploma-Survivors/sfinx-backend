import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddInterviewScheduledEndAt1773551742754 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'ai_interviews',
      new TableColumn({
        name: 'scheduled_end_at',
        type: 'timestamptz',
        isNullable: true,
      }),
    );

    // Add index for efficient querying
    await queryRunner.createIndex(
      'ai_interviews',
      new TableIndex({
        name: 'idx_ai_interviews_scheduled_end_at',
        columnNames: ['scheduled_end_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'ai_interviews',
      'idx_ai_interviews_scheduled_end_at',
    );
    await queryRunner.dropColumn('ai_interviews', 'scheduled_end_at');
  }
}
