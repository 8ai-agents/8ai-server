import { Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  contacts: ContactTable;
  conversations: ConversationTable;
  messages: MessageTable;
  users: UserTable;
  organisations: OrganisationTable;
  organisation_files: OrganisationFileTable;
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
  assignee_id: string | undefined;
  created_at: number;
  last_message_at: number;
  interrupted: boolean;
  status: ConversationStatusType;
  summary: string | undefined;
  sentiment: number | undefined;
}

export enum ConversationStatusType {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export type Conversation = Selectable<ConversationTable>;
export type NewConversation = Insertable<ConversationTable>;
export type ConversationUpdate = Updateable<ConversationTable>;

export interface MessageTable {
  id: string;
  conversation_id: string;
  message: string;
  created_at: number;
  creator: MessageCreatorType;
  user_id: string | undefined;
  version: number;
}

export enum MessageCreatorType {
  AGENT = "AGENT",
  CONTACT = "CONTACT",
  USER = "USER",
}

export type Message = Selectable<MessageTable>;
export type NewMessage = Insertable<MessageTable>;

export interface UserTable {
  id: string;
  organisation_id: string;
  name: string;
  email: string;
  phone: string | undefined;
  role: UserRoleType;
}

export enum UserRoleType {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface OrganisationTable {
  id: string;
  name: string;
  assistant_id: string | undefined;
  description: string;
  website: string;
  logo_url: string;
  support_email: string;
  support_phone: string;
  chat_icon_color: string;
  chat_bubble_color: string;
  chat_text_color: string;
  fine_tuning_filename: string;
}

export type Organisation = Selectable<OrganisationTable>;
export type NewOrganisation = Insertable<OrganisationTable>;
export type OrganisationUpdate = Updateable<OrganisationTable>;

export interface OrganisationFileTable {
  id: string;
  organisation_id: string;
  url: string;
  content: string;
}

export type OrganisationFile = Selectable<OrganisationFileTable>;
export type NewOrganisationFile = Insertable<OrganisationFileTable>;
