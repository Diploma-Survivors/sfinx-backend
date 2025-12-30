import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameLocationToAddress implements MigrationInterface {
  name = 'RenameLocationToAddress1735550000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Rename column from avatar_url to avatar_key
    const hasLocation = await queryRunner.hasColumn('users', 'location');
    const hasAddress = await queryRunner.hasColumn('users', 'address');
    if (hasLocation && !hasAddress) {
      await queryRunner.query(`
              ALTER TABLE "users"
              RENAME COLUMN "location" TO "address"
            `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      RENAME COLUMN "address" TO "location"
    `);
  }
}
