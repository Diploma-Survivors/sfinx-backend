import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateNotificationsTable1772020684814 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "notification_type_enum" AS ENUM ('SYSTEM', 'COMMENT', 'REPLY', 'CONTEST', 'MENTION')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'recipient_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'sender_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'type',
            type: 'notification_type_enum',
            default: `'SYSTEM'`,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'link',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_read',
            type: 'boolean',
            default: false,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['recipient_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['sender_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('notifications');
    if (table) {
      const fks = table.foreignKeys;
      for (const fk of fks) {
        await queryRunner.dropForeignKey('notifications', fk);
      }
    }

    await queryRunner.dropTable('notifications', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "notification_type_enum"`);
  }
}
