import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";
import { ConversationsResponse } from "../models/ConversationsResponse";
import { NewContact, NewConversation } from "../models/Database";
import { db } from "../DatabaseController";
import { ContactResponse } from "../models/ContactResponse";

export async function createConversation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const org_id = request.params.org_id;
    context.log(`Creating new conversation for org ${org_id}`);
    // TODO get API key from Org ID
    const openai = new OpenAI({
      apiKey: "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",
    });
    const thread = await openai.beta.threads.create();
    const newContact: ContactResponse = new ContactResponse();
    const response: ConversationsResponse = new ConversationsResponse(
      thread.id,
      newContact.name
    );

    // Save to db
    const contactToSave: NewContact = {
      ...newContact,
      organisation_id: org_id,
    };
    await db.insertInto("contacts").values(contactToSave).execute();
    const converationToSave: NewConversation = {
      id: response.id,
      organisation_id: org_id,
      contact_id: contactToSave.id,
      created_at: response.created_at,
      last_message_at: response.last_message_at,
      status: response.status,
      summary: response.summary,
      sentiment: 0,
      interrupted: false,
    };
    await db.insertInto("conversations").values(converationToSave).execute();

    return { status: 200, jsonBody: response };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't generate thread`,
      },
    };
  }
}

app.http("createConversation", {
  methods: ["GET"],
  route: "chat/{org_id}/new",
  authLevel: "anonymous",
  handler: createConversation,
});
