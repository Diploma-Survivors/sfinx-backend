import { MigrationInterface, QueryRunner } from 'typeorm';

export class FavoriteList1770456084790 implements MigrationInterface {
  name = 'FavoriteList1770456084790';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP CONSTRAINT "UQ_a5b7914a3973f0a78ebfcca346f"`,
    );
    await queryRunner.query(
      `CREATE TABLE "favorite_lists" ("id" SERIAL NOT NULL, "name" character varying(255) NOT NULL, "icon" character varying(10) NOT NULL DEFAULT '📝', "is_public" boolean NOT NULL DEFAULT false, "is_default" boolean NOT NULL DEFAULT false, "user_id" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_33aad4fbe9873b39ff1e2d0e0b1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "favorite_list_problems" ("list_id" integer NOT NULL, "problem_id" integer NOT NULL, CONSTRAINT "PK_30545940c76aa5883da621bf1bc" PRIMARY KEY ("list_id", "problem_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2b3c44f595b8c5a87d1e6b66f8" ON "favorite_list_problems" ("list_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6074db2d9ee81e0b9e6c8cf849" ON "favorite_list_problems" ("problem_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" ADD CONSTRAINT "FK_41c908fd16120b7488789306a37" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_list_problems" ADD CONSTRAINT "FK_2b3c44f595b8c5a87d1e6b66f80" FOREIGN KEY ("list_id") REFERENCES "favorite_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_list_problems" ADD CONSTRAINT "FK_6074db2d9ee81e0b9e6c8cf8497" FOREIGN KEY ("problem_id") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "favorite_list_problems" DROP CONSTRAINT "FK_6074db2d9ee81e0b9e6c8cf8497"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_list_problems" DROP CONSTRAINT "FK_2b3c44f595b8c5a87d1e6b66f80"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_lists" DROP CONSTRAINT "FK_41c908fd16120b7488789306a37"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6074db2d9ee81e0b9e6c8cf849"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_2b3c44f595b8c5a87d1e6b66f8"`,
    );
    await queryRunner.query(`DROP TABLE "favorite_list_problems"`);
    await queryRunner.query(`DROP TABLE "favorite_lists"`);
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" ADD CONSTRAINT "UQ_a5b7914a3973f0a78ebfcca346f" UNIQUE ("user_id", "post_id")`,
    );
  }
}
