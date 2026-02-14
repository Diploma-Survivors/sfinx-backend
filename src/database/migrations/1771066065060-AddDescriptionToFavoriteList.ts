import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDescriptionToFavoriteList1771066065060 implements MigrationInterface {
  name = 'AddDescriptionToFavoriteList1771066065060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'favorite_lists',
      new TableColumn({
        name: 'description',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('favorite_lists', 'description');
  }
}
