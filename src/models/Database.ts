import { Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  contacts: ContactTable;
  conversations: ConversationTable;
  messages: MessageTable;
  users: UserTable;
  organisations: OrganisationTable;
}

export interface ContactTable {
  id: string;
  organisation_id: string;
  name: string;
  email: string | undefined;
  phone: string | undefined;
}

export type Contact = Selectable<ContactTable>;
export type NewContact = Insertable<ContactTable>;
export type ContactUpdate = Updateable<ContactTable>;

export interface ConversationTable {
  id: string;
  organisation_id: string;
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
  creator: "AGENT" | "CONTACT" | "USER";
  user_id: string | undefined;
}

export type Message = Selectable<MessageTable>;
export type NewMessage = Insertable<MessageTable>;

export interface UserTable {
  id: string;
  organisation_id: string;
  name: string;
  email: string;
  phone: string | undefined;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface OrganisationTable {
  id: string;
  name: string;
}

export type Organisation = Selectable<OrganisationTable>;
export type NewOrganisation = Insertable<OrganisationTable>;
export type OrganisationUpdate = Updateable<OrganisationTable>;
