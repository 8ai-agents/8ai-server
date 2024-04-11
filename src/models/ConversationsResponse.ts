export class ConversationsResponse {
  id: string; // conv_xxx
  contact_name: string;
  created_at: number;
  last_message_at: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  summary: string;

  constructor(thread_id: string, contact_name: string) {
    this.id = thread_id.replace("thread_", "conv_");
    this.contact_name = contact_name;
    this.created_at = Date.now();
    this.last_message_at = Date.now();
    (this.status = "DRAFT"), (this.summary = "");
  }
}
