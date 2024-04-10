import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

export class ConversationsResponse {
  id: string; // conv_xxx
  contact_name: string;
  created_at: number;
  last_message_at: number;
  status: "DRAFT" | "OPEN" | "CLOSED";
  summary: string;

  constructor(thread_id: string) {
    this.id = thread_id.replace("thread_", "conv_");
    this.contact_name = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: " ",
    });
    this.created_at = Date.now();
    this.last_message_at = Date.now();
    (this.status = "DRAFT"), (this.summary = "");
  }
}
