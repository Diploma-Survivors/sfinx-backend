import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSavedFavoriteLists1770828816475 implements MigrationInterface {
  name = 'CreateSavedFavoriteLists1770828816475';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "saved_favorite_lists" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "favorite_list_id" integer NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1824dd9abd79caea784820749b5" UNIQUE ("user_id", "favorite_list_id"), CONSTRAINT "PK_75b4d53e8768f0966be800f32bc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_favorite_lists" ADD CONSTRAINT "FK_c85eca3c48a39bc4a1a6bf613a2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_favorite_lists" ADD CONSTRAINT "FK_d0a0422e430ca84a7b34af3cca0" FOREIGN KEY ("favorite_list_id") REFERENCES "favorite_lists"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_favorite_lists" DROP CONSTRAINT "FK_d0a0422e430ca84a7b34af3cca0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "saved_favorite_lists" DROP CONSTRAINT "FK_c85eca3c48a39bc4a1a6bf613a2"`,
    );
    await queryRunner.query(`DROP TABLE "saved_favorite_lists"`);
  }
}
