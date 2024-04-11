import { randomBytes } from "crypto";

export class MessageResponse {
  id: string;
  conversation_id: string;
  message: string;
  created_at: number;
  creator: "AGENT" | "CONTACT" | "USER";

  constructor(
    conversation_id: string,
    message: string,
    creator: "AGENT" | "CONTACT" | "USER"
  ) {
    this.id = `msg_${randomBytes(15).toString("hex")}`;
    this.conversation_id = conversation_id;
    this.message = message;
    this.created_at = Date.now();
    this.creator = creator;
  }
}
