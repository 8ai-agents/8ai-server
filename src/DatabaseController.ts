import * as pg from "pg";
import { Kysely, PostgresDialect } from "kysely";
import {
  ConversationStatusType,
  Database,
  NewMessage,
} from "./models/Database";
import { ConversationResponse } from "./models/ConversationResponse";
import { MessageResponse } from "./models/MessageResponse";
import { OrganisationResponse } from "./models/OrganisationResponse";
import { UserResponse } from "./models/UserReponse";

const int8TypeId = 20;
// Map int8 to number.
pg.types.setTypeParser(int8TypeId, (val) => {
  return parseInt(val, 10);
});

// Database interface is passed to Kysely's constructor, and from now on, Kysely
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how
// to communicate with your database.
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      database: process.env.PG_DATABASE,
      host: process.env.PG_HOST,
      user: "server",
      port: 5432,
      max: 5,
      password: process.env.PG_PASSWORD,
      ssl: true,
    }),
  }),
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
      "conversations.organisation_id",
      "conversations.contact_id",
      "contacts.name",
      "contacts.email",
      "contacts.phone",
      "contacts.updated_at",
      "conversations.created_at",
      "conversations.last_message_at",
      "conversations.status",
      "conversations.summary",
      "conversations.sentiment",
      "conversations.channel",
    ])
    .executeTakeFirst();

  if (conversationData) {
    return {
      id: conversationData.id,
      organisation_id: conversationData.organisation_id,
      contact: {
        id: conversationData.contact_id,
        name: conversationData.name,
        email: conversationData.email,
        phone: conversationData.phone,
        updated_at: conversationData.updated_at,
        conversations: undefined,
      },
      messages: await getMessagesForConversation(conv_id),
      created_at: conversationData.created_at,
      last_message_at: conversationData.last_message_at,
      status: conversationData.status,
      summary: conversationData.summary,
      sentiment: conversationData.sentiment,
      channel: conversationData.channel,
    };
  } else {
    throw "Can't find coversation";
  }
};

export const getMessagesForConversation = async (
  conv_id: string
): Promise<MessageResponse[]> => {
  const data = await db
    .selectFrom("messages")
    .where("conversation_id", "=", conv_id)
    .orderBy("created_at", "desc")
    .selectAll()
    .execute();

  return data.map((m) => {
    return {
      ...m,
      user_id: m.user_id ? m.user_id : undefined,
      conversation_id: conv_id,
      citations: m.citations ? JSON.parse(m.citations) : undefined,
    };
  });
};

export const getOrganisation = async (
  org_id: string
): Promise<OrganisationResponse> => {
  const data = await db
    .selectFrom("organisations")
    .where("organisations.id", "=", org_id)
    .select([
      "id",
      "name",
      "assistant_id",
      "description",
      "website",
      "logo_url",
      "support_email",
      "support_phone",
      "chat_icon_color",
      "chat_bubble_color",
      "chat_text_color",
      "fine_tuning_filename",
      "default_questions",
    ])
    .executeTakeFirstOrThrow();

  const result: OrganisationResponse = {
    ...data,
  };
  return result;
};

export const getUser = async (email: string): Promise<UserResponse> => {
  const user = await db
    .selectFrom("users")
    .select(["users.id", "users.email", "users.name", "users.phone"])
    .where("email", "=", email.toLowerCase())
    .executeTakeFirst()
    .then((user) => {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        roles: [],
      };
    });

  user.roles = await db
    .selectFrom("user_roles")
    .leftJoin("organisations", "organisations.id", "user_roles.organisation_id")
    .select([
      "user_roles.role",
      "user_roles.organisation_id as organisation_id",
      "organisations.name as organisation_name",
    ])
    .where("user_roles.user_id", "=", user.id)
    .execute()
    .then((roles) =>
      roles.map((r) => {
        return { ...r, user_id: user.id };
      })
    );

  return user;
};

export const saveMessagesToDatabase = (
  messages: NewMessage[],
  setInterrupted: boolean
) => {
  return Promise.all([
    db.insertInto("messages").values(messages).execute(),
    setInterrupted
      ? db
          .updateTable("conversations")
          .set({
            last_message_at: Math.max(...messages.map((r) => r.created_at)),
            status: ConversationStatusType.OPEN,
            interrupted: true,
          })
          .where("id", "=", messages[0].conversation_id)
          .execute()
      : db
          .updateTable("conversations")
          .set({
            last_message_at: Math.max(...messages.map((r) => r.created_at)),
            status: ConversationStatusType.OPEN,
          })
          .where("id", "=", messages[0].conversation_id)
          .execute(),
  ]);
};

export const saveMessageResponsesToDatabase = (
  messages: MessageResponse[] | undefined,
  setInterrupted: boolean
) => {
  const messagesToSave: NewMessage[] = messages
    ? messages.map((r) => {
        return {
          id: r.id,
          conversation_id: r.conversation_id,
          message: r.message,
          created_at: r.created_at,
          creator: r.creator,
          version: r.version,
          citations: r.citations ? JSON.stringify(r.citations) : undefined,
        };
      })
    : undefined;
  return saveMessagesToDatabase(messagesToSave, setInterrupted);
};
