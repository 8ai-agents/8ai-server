import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { ConversationsResponse } from "./ConversationsResponse";
import { createID } from "../Utils";

export class ContactResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  conversations: ConversationsResponse[] | undefined = undefined;
  created_at: number | undefined = undefined;
  updated_at: number | undefined = undefined;

  constructor() {
    this.id = createID("cont");
    this.name = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: " ",
      style: "capital",
    });
    this.created_at = Date.now();
  }
}
