import { ContactResponse } from "./ContactResponse";
import { MessageResponse } from "./MessageResponse";

export interface ConversationResponse {
  id: string; // conv_xxx
  contact: ContactResponse;
  created_at: number;
  last_message_at: number;
  messages: MessageResponse[];
  status: "DRAFT" | "OPEN" | "CLOSED";
  summary: string;
  sentiment: number;
}
