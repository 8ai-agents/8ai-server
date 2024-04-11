export class MessageRequest {
  conversation_id: string;
  message: string;
  creator: "AGENT" | "CONTACT" | "USER" = "CONTACT";
}
