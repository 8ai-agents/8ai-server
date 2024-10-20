import { ConversationChannelType, ConversationStatusType } from "./Database";

export class ConversationsResponse {
  id: string; // conv_xxx
  organisation_id: string; // org_xxx
  contact_name: string;
  has_contact_details: boolean;
  created_at: number;
  last_message_at: number;
  status: ConversationStatusType;
  summary: string;
  sentiment: number;
  channel: ConversationChannelType;
  resolution_estimation: number | undefined;
  last_summarisation_at: number | undefined;

  constructor(
    thread_id: string,
    contact_name: string,
    organisation_id: string,
  ) {
    this.id = thread_id.replace("thread_", "conv_");
    this.organisation_id = organisation_id;
    this.contact_name = contact_name;
    this.has_contact_details = false;
    this.created_at = Date.now();
    this.last_message_at = Date.now();
    this.status = ConversationStatusType.DRAFT;
    this.summary = "";
    this.sentiment = 0;
    this.channel = ConversationChannelType.CHAT;
    this.resolution_estimation = undefined;
    this.last_summarisation_at = undefined;
  }
}
