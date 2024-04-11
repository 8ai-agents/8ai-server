import { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { Database } from "./models/Database";
import { ConversationResponse } from "./models/ConversationResponse";

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

export const getFullConversation = async (
  conv_id: string
): Promise<ConversationResponse> => {
  const conversationData = await db
    .selectFrom("conversations")
    .leftJoin("contacts", "contacts.id", "conversations.contact_id")
    .where("conversations.id", "=", conv_id)
    .select([
      "conversations.id",
      "conversations.contact_id",
      "contacts.name",
      "contacts.email",
      "contacts.phone",
      "conversations.created_at",
      "conversations.last_message_at",
      "conversations.status",
      "conversations.summary",
      "conversations.sentiment",
    ])
    .executeTakeFirst();

  if (conversationData) {
    const messageData = await db
      .selectFrom("messages")
      .where("conversation_id", "=", conv_id)
      .selectAll()
      .execute();
    const result: ConversationResponse = {
      id: conversationData.id,
      contact: {
        id: conversationData.contact_id,
        name: conversationData.name,
        email: conversationData.email,
        phone: conversationData.phone,
        conversations: undefined,
      },
      messages: messageData,
      created_at: conversationData.created_at,
      last_message_at: conversationData.last_message_at,
      status: conversationData.status,
      summary: conversationData.summary,
      sentiment: conversationData.sentiment,
    };
    return result;
  } else {
    throw "Can't find coversation";
  }
};
