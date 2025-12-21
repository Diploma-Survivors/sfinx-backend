import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPasswordResetAndEmailVerificationTokens1734757200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create password_reset_tokens table
    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_password_reset_tokens_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Create indexes for password_reset_tokens
    await queryRunner.query(`
      CREATE INDEX idx_password_reset_tokens_token
        ON password_reset_tokens(token)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_password_reset_tokens_user_id
        ON password_reset_tokens(user_id)
    `);

    // Create email_verification_tokens table
    await queryRunner.query(`
      CREATE TABLE email_verification_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT fk_email_verification_tokens_user
          FOREIGN KEY (user_id)
          REFERENCES users(id)
          ON DELETE CASCADE
      )
    `);

    // Create indexes for email_verification_tokens
    await queryRunner.query(`
      CREATE INDEX idx_email_verification_tokens_token
        ON email_verification_tokens(token)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_email_verification_tokens_user_id
        ON email_verification_tokens(user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop email_verification_tokens table
    await queryRunner.query(`DROP TABLE IF EXISTS email_verification_tokens`);

    // Drop password_reset_tokens table
    await queryRunner.query(`DROP TABLE IF EXISTS password_reset_tokens`);
  }
}
