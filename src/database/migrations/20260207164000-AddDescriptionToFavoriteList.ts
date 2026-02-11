import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDescriptionToFavoriteList1770455817000 implements MigrationInterface {
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
