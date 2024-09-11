import { Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  contacts: ContactTable;
  conversations: ConversationTable;
  messages: MessageTable;
  users: UserTable;
  notification_settings: NotificationSettingsTable;
  organisations: OrganisationTable;
  organisation_files: OrganisationFileTable;
  organisation_slack: OrganisationSlackTable;
}

export interface ContactTable {
  id: string;
  organisation_id: string;
  name: string;
  email: string | undefined;
  phone: string | undefined;
  slack_id: string | undefined;
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
  channel: ConversationChannelType;
  channel_id: string | undefined;
}

export enum ConversationChannelType {
  CHAT = "CHAT",
  SLACK = "SLACK",
  EMAIL = "EMAIL",
  WHATSAPP = "WHATSAPP",
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
  citations: string | undefined;
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
  default_questions: string[];
}

export type Organisation = Selectable<OrganisationTable>;
export type NewOrganisation = Insertable<OrganisationTable>;
export type OrganisationUpdate = Updateable<OrganisationTable>;

export interface OrganisationFileTable {
  id: string;
  organisation_id: string;
  name: string;
  url: string;
  content: string;
}

export type OrganisationFile = Selectable<OrganisationFileTable>;
export type NewOrganisationFile = Insertable<OrganisationFileTable>;

export interface OrganisationSlackTable {
  id: string;
  organisation_id: string;
  workspace_id: string;
  bot_token: string;
  signing_secret: string;
  internal_user_list: string; // this is a comma seperated array of user IDS
}

export type OrganisationSlack = Selectable<OrganisationSlackTable>;

export interface NotificationSettingsTable {
  user_id: string;
  type: NotificationSettingsType;
  enabled: boolean;
}

export enum NotificationSettingsType {
  DAILY_SUMMARY = "DAILY_SUMMARY",
  NEGATIVE_SENTIMENT = "NEGATIVE_SENTIMENT",
  CONTACT_DETAILS_LEFT = "CONTACT_DETAILS_LEFT",
  NEW_CONVERSATION = "NEW_CONVERSATION",
}

export type NotificationSettings = Selectable<NotificationSettingsTable>;
export type NewNotificationSettings = Insertable<NotificationSettingsTable>;
export type NotificationSettingsUpdate = Updateable<NotificationSettingsTable>;
