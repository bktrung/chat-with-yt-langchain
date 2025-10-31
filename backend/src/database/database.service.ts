import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {

  private db!: NodePgDatabase<typeof schema>;
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    this.pool = new Pool({ 
      connectionString,
      keepAlive: true,
      max: 10,
    });
  }

  get client(): NodePgDatabase<typeof schema> {
    if (!this.db) {
      throw new Error('Database client not initialized');
    }
    return this.db;
  }

  async onModuleInit() {
    await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}

export type Database = typeof schema;
export { schema };
