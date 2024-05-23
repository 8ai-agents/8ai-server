import { MessageCreatorType } from "./Database";
import { createID } from "../Utils";

export interface MessageResponseCitation {
  id: number;
  name: string;
  url: string;
}

export class MessageResponse {
  id: string;
  conversation_id: string;
  message: string;
  created_at: number;
  creator: MessageCreatorType;
  version: number;
  citations?: MessageResponseCitation[];

  constructor(
    conversation_id: string,
    message: string,
    creator: MessageCreatorType,
    created_at?: number,
    citations?: MessageResponseCitation[]
  ) {
    this.id = createID("msg");
    this.conversation_id = conversation_id;
    this.message = message;
    this.created_at = created_at || Date.now();
    this.creator = creator;
    this.version = 2;
    this.citations = citations;
  }
}
