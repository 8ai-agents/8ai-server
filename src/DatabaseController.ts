import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { Database } from "./models/Database";

const dialect = new PostgresDialect({
  pool: new Pool({
    database: process.env.PG_DATABASE,
    host: "8ai-prod.postgres.database.azure.com",
    user: "server",
    port: 5432,
    max: 5,
    password: process.env.PG_PASSWORD,
    ssl: true,
  }),
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<Database>({
  dialect,
});
