import { ConversationStatusType } from "./Database";

export class ConversationsResponse {
  id: string; // conv_xxx
  organisation_id: string; // org_xxx
  contact_name: string;
  created_at: number;
  last_message_at: number;
  status: ConversationStatusType;
  summary: string;
  sentiment: number;

  constructor(
    thread_id: string,
    contact_name: string,
    organisation_id: string
  ) {
    this.id = thread_id.replace("thread_", "conv_");
    this.organisation_id = organisation_id;
    this.contact_name = contact_name;
    this.created_at = Date.now();
    this.last_message_at = Date.now();
    (this.status = ConversationStatusType.DRAFT), (this.summary = "");
    this.sentiment = 0;
  }
}
