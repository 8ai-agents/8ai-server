import { MessageCreatorType } from "./Database";

export class MessageRequest {
  conversation_id: string | undefined;
  organisation_id: string | undefined;
  message: string;
  creator: MessageCreatorType = MessageCreatorType.CONTACT;
}
