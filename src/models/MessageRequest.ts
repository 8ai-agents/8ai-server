import { MessageCreatorType } from "./Database";

export class MessageRequest {
  conversation_id: string;
  message: string;
  creator: MessageCreatorType = MessageCreatorType.CONTACT;
}
