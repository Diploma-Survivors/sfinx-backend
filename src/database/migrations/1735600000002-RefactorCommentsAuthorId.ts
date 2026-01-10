import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorCommentsAuthorId1735600000002 implements MigrationInterface {
  name = 'RefactorCommentsAuthorId1735600000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename user_id to author_id in comments table
    await queryRunner.renameColumn('comments', 'user_id', 'author_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert renaming
    await queryRunner.renameColumn('comments', 'author_id', 'user_id');
  }
}
