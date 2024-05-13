import { randomBytes } from "crypto";
import { MessageCreatorType } from "./Database";

export class MessageResponse {
  id: string;
  conversation_id: string;
  message: string;
  created_at: number;
  creator: MessageCreatorType;

  constructor(
    conversation_id: string,
    message: string,
    creator: MessageCreatorType,
    created_at?: number
  ) {
    this.id = `msg_${randomBytes(8).toString("hex")}`;
    this.conversation_id = conversation_id;
    this.message = message;
    this.created_at = created_at || Date.now();
    this.creator = creator;
  }
}
