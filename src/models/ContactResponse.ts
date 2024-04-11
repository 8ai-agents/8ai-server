import { randomBytes } from "crypto";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";

export class ContactResponse {
  id: string;
  name: string;
  email: string;
  phone: string;

  constructor() {
    this.id = `cont_${randomBytes(15).toString("hex")}`;
    this.name = uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      separator: " ",
    });
  }
}
