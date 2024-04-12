import { randomBytes } from "crypto";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { ConversationsResponse } from "./ConversationsResponse";

export class ContactResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  conversations: ConversationsResponse[] | undefined = undefined;

  constructor() {
    this.id = `cont_${randomBytes(8).toString("hex")}`;
    this.name = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: " ",
      style: "capital",
    });
  }
}
