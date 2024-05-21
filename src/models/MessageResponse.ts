import { MessageCreatorType } from "./Database";
import { createID } from "../Utils";

export class MessageResponse {
  id: string;
  conversation_id: string;
  message: string;
  created_at: number;
  creator: MessageCreatorType;
  version: number;

  constructor(
    conversation_id: string,
    message: string,
    creator: MessageCreatorType,
    created_at?: number
  ) {
    this.id = createID("msg");
    this.conversation_id = conversation_id;
    this.message = message;
    this.created_at = created_at || Date.now();
    this.creator = creator;
    this.version = 1;
  }
}
