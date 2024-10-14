import { Insertable, Selectable, Updateable } from "kysely";

export interface Database {
  contacts: ContactTable;
  conversations: ConversationTable;
  messages: MessageTable;
  users: UserTable;
  user_roles: UserRoleTable;
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
  updated_at: number;
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
  feedback_rating: FeedbackRatingType;
  feedback_suggestion: string;
  feedback_created_at: number;
  feedback_user_id: string;
  resolution_estimation: number | undefined;
  last_summarisation_at: number | undefined;
}

export enum FeedbackRatingType {
  INCORRECT = "INCORRECT",
  NOT_HELPFUL = "NOT_HELPFUL",
  HELPFUL = "HELPFUL",
  VERY_HELPFUL = "VERY_HELPFUL",
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
  name: string;
  email: string;
  phone: string | undefined;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export interface UserRoleTable {
  organisation_id: string;
  user_id: string;
  role: UserRoleType;
  active: boolean;
}

export enum UserRoleType {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

export type UserRole = Selectable<UserRoleTable>;
export type NewUserRole = Insertable<UserRoleTable>;

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
  system_prompt: string;
  auto_close_conversations: boolean;
}

export type Organisation = Selectable<OrganisationTable>;
export type NewOrganisation = Insertable<OrganisationTable>;
export type OrganisationUpdate = Updateable<OrganisationTable>;

export interface OrganisationFileTable {
  id: string;
  organisation_id: string;
  original_filename: string;
  name: string;
  url: string;
  content: string;
  openai_id: string;
  created_at: number;
  updated_at: number;
}

export type OrganisationFile = Selectable<OrganisationFileTable>;
export type NewOrganisationFile = Insertable<OrganisationFileTable>;
export type OrganisationFileToUpdate = Updateable<OrganisationFileTable>;

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
  WEEKLY_SUMMARY = "WEEKLY_SUMMARY",
  NEGATIVE_SENTIMENT = "NEGATIVE_SENTIMENT",
  NEGATIVE_SENTIMENT_SMS = "NEGATIVE_SENTIMENT_SMS",
  NEGATIVE_SENTIMENT_WHATSAPP = "NEGATIVE_SENTIMENT_WHATSAPP",
  CONTACT_DETAILS_LEFT = "CONTACT_DETAILS_LEFT",
  CONTACT_DETAILS_LEFT_SMS = "CONTACT_DETAILS_LEFT_SMS",
  CONTACT_DETAILS_LEFT_WHATSAPP = "CONTACT_DETAILS_LEFT_WHATSAPP",
  NEW_CONVERSATION = "NEW_CONVERSATION",
  NEW_CONVERSATION_SMS = "NEW_CONVERSATION_SMS",
  NEW_CONVERSATION_WHATSAPP = "NEW_CONVERSATION_WHATSAPP",
}

export type NotificationSettings = Selectable<NotificationSettingsTable>;
export type NewNotificationSettings = Insertable<NotificationSettingsTable>;
export type NotificationSettingsUpdate = Updateable<NotificationSettingsTable>;
