import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscuss1769328560743 implements MigrationInterface {
  name = 'AddDiscuss1769328560743';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "discuss_tags" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "slug" character varying(100) NOT NULL, "color" character varying(7), "description" text, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_346ccbd9f7602924682a2ca7349" UNIQUE ("name"), CONSTRAINT "UQ_01283f1c996a22c9c01936e64d3" UNIQUE ("slug"), CONSTRAINT "PK_227222e585514c07b3ba43f8148" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "discuss_comment_votes" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "comment_id" integer NOT NULL, "vote_type" character varying(10) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7eed54e8e733c8dcc9048896665" UNIQUE ("user_id", "comment_id"), CONSTRAINT "PK_cf295340af6d69549a30c5926fd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "discuss_comments" ("id" SERIAL NOT NULL, "author_id" integer NOT NULL, "parent_id" integer, "content" text NOT NULL, "upvote_count" integer NOT NULL DEFAULT '0', "downvote_count" integer NOT NULL DEFAULT '0', "reply_count" integer NOT NULL DEFAULT '0', "is_pinned" boolean NOT NULL DEFAULT false, "is_edited" boolean NOT NULL DEFAULT false, "is_deleted" boolean NOT NULL DEFAULT false, "vote_score" integer NOT NULL DEFAULT '0', "edited_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "post_id" uuid NOT NULL, CONSTRAINT "PK_ab39a1c20a554a1da01333a4da3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "discuss_post_votes" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "post_id" uuid NOT NULL, "vote_type" character varying(10) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a5b7914a3973f0a78ebfcca346f" UNIQUE ("user_id", "post_id"), CONSTRAINT "PK_7ef9f6a08a42568d716d6d87b70" PRIMARY KEY ("id")); COMMENT ON COLUMN "discuss_post_votes"."vote_type" IS 'UP or DOWN'`,
    );
    await queryRunner.query(
      `CREATE TABLE "discuss_posts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "content" text NOT NULL, "slug" character varying NOT NULL, "view_count" integer NOT NULL DEFAULT '0', "upvote_count" integer NOT NULL DEFAULT '0', "comment_count" integer NOT NULL DEFAULT '0', "is_locked" boolean NOT NULL DEFAULT false, "is_deleted" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "author_id" integer, CONSTRAINT "UQ_b70a797512e62441238cf1be18b" UNIQUE ("slug"), CONSTRAINT "PK_c7bb5f93ef10ca2f434d4b2a4e5" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "discuss_post_tags" ("post_id" uuid NOT NULL, "tag_id" integer NOT NULL, CONSTRAINT "PK_3e3e529496a371c384b2405ed39" PRIMARY KEY ("post_id", "tag_id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_59ffa84b7b39943d64e82522c0" ON "discuss_post_tags" ("post_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3a1ef157fa603f167f2ec61edd" ON "discuss_post_tags" ("tag_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comment_votes" ADD CONSTRAINT "FK_64d400f08ea1e86a68164a59be2" FOREIGN KEY ("comment_id") REFERENCES "discuss_comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comment_votes" ADD CONSTRAINT "FK_aec22cbd6099100d0c54eceadfb" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comments" ADD CONSTRAINT "FK_ba3a8109f0ba9ed52b3ba07cb4e" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comments" ADD CONSTRAINT "FK_724b7977406744964a1d9389308" FOREIGN KEY ("post_id") REFERENCES "discuss_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comments" ADD CONSTRAINT "FK_2db1afebeb1e4d4979b721e17a4" FOREIGN KEY ("parent_id") REFERENCES "discuss_comments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" ADD CONSTRAINT "FK_7b956f50aae95b58703574f1309" FOREIGN KEY ("post_id") REFERENCES "discuss_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" ADD CONSTRAINT "FK_a1c63725f005b17bc4e9b30f7c0" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_posts" ADD CONSTRAINT "FK_da904cd66ffd0d6e49c8297c256" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_tags" ADD CONSTRAINT "FK_59ffa84b7b39943d64e82522c0e" FOREIGN KEY ("post_id") REFERENCES "discuss_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_tags" ADD CONSTRAINT "FK_3a1ef157fa603f167f2ec61edd8" FOREIGN KEY ("tag_id") REFERENCES "discuss_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "discuss_post_tags" DROP CONSTRAINT "FK_3a1ef157fa603f167f2ec61edd8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_tags" DROP CONSTRAINT "FK_59ffa84b7b39943d64e82522c0e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_posts" DROP CONSTRAINT "FK_da904cd66ffd0d6e49c8297c256"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP CONSTRAINT "FK_a1c63725f005b17bc4e9b30f7c0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_post_votes" DROP CONSTRAINT "FK_7b956f50aae95b58703574f1309"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comments" DROP CONSTRAINT "FK_2db1afebeb1e4d4979b721e17a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comments" DROP CONSTRAINT "FK_724b7977406744964a1d9389308"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comments" DROP CONSTRAINT "FK_ba3a8109f0ba9ed52b3ba07cb4e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comment_votes" DROP CONSTRAINT "FK_aec22cbd6099100d0c54eceadfb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "discuss_comment_votes" DROP CONSTRAINT "FK_64d400f08ea1e86a68164a59be2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a1ef157fa603f167f2ec61edd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_59ffa84b7b39943d64e82522c0"`,
    );
    await queryRunner.query(`DROP TABLE "discuss_post_tags"`);
    await queryRunner.query(`DROP TABLE "discuss_posts"`);
    await queryRunner.query(`DROP TABLE "discuss_post_votes"`);
    await queryRunner.query(`DROP TABLE "discuss_comments"`);
    await queryRunner.query(`DROP TABLE "discuss_comment_votes"`);
    await queryRunner.query(`DROP TABLE "discuss_tags"`);
  }
}
