import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncProblemSchema1771074485554 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop stale columns removed from Submission entity
    const colsToDrop = [
      'code_length',
      'error_line',
      'error_message',
      'compile_output',
    ];
    for (const col of colsToDrop) {
      if (await queryRunner.hasColumn('submissions', col)) {
        await queryRunner.dropColumn('submissions', col);
      }
    }

    // Rename: code -> source_code
    const hasCode = await queryRunner.hasColumn('submissions', 'code');
    const hasSourceCode = await queryRunner.hasColumn(
      'submissions',
      'source_code',
    );
    if (hasCode && !hasSourceCode) {
      await queryRunner.renameColumn('submissions', 'code', 'source_code');
    }

    // Rename: testcase_results -> result_description
    const hasTestcaseResults = await queryRunner.hasColumn(
      'submissions',
      'testcase_results',
    );
    const hasResultDescription = await queryRunner.hasColumn(
      'submissions',
      'result_description',
    );
    if (hasTestcaseResults && !hasResultDescription) {
      await queryRunner.renameColumn(
        'submissions',
        'testcase_results',
        'result_description',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse renames
    if (await queryRunner.hasColumn('submissions', 'source_code'))
      await queryRunner.renameColumn('submissions', 'source_code', 'code');
    if (await queryRunner.hasColumn('submissions', 'result_description'))
      await queryRunner.renameColumn(
        'submissions',
        'result_description',
        'testcase_results',
      );

    // Re-add dropped columns
    if (!(await queryRunner.hasColumn('submissions', 'compile_output')))
      await queryRunner.query(
        `ALTER TABLE "submissions" ADD COLUMN "compile_output" text`,
      );
    if (!(await queryRunner.hasColumn('submissions', 'error_message')))
      await queryRunner.query(
        `ALTER TABLE "submissions" ADD COLUMN "error_message" text`,
      );
    if (!(await queryRunner.hasColumn('submissions', 'error_line')))
      await queryRunner.query(
        `ALTER TABLE "submissions" ADD COLUMN "error_line" integer`,
      );
    if (!(await queryRunner.hasColumn('submissions', 'code_length')))
      await queryRunner.query(
        `ALTER TABLE "submissions" ADD COLUMN "code_length" integer`,
      );
  }
}
