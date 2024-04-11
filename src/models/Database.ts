import { Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  contacts: ContactTable;
  conversations: ConversationTable;
  messages: MessageTable;
}

export interface ContactTable {
  id: string;
  name: string;
  email: string | undefined;
  phone: string | undefined;
}

export type Contact = Selectable<ContactTable>;
export type NewContact = Insertable<ContactTable>;
export type ContactUpdate = Updateable<ContactTable>;

export interface ConversationTable {
  id: string;
  contact_id: string;
  created_at: number;
  last_message_at: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  summary: string | undefined;
  sentiment: number | undefined;
}

export type Conversation = Selectable<ConversationTable>;
export type NewConversation = Insertable<ConversationTable>;
export type ConversationUpdate = Updateable<ConversationTable>;

export interface MessageTable {
  id: string;
  conversation_id: string;
  message: string;
  created_at: number;
  creator: "AGENT" | "CONTACT";
}

export type Message = Selectable<MessageTable>;
export type NewMessage = Insertable<MessageTable>;
