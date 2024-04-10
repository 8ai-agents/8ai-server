import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";
import { ConversationsResponse } from "../models/ConversationsResponse";

export async function createConversation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    context.log(`Creating new conversation`);
    const openai = new OpenAI({
      apiKey: "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",
    });
    const thread = await openai.beta.threads.create();
    const response: ConversationsResponse = new ConversationsResponse(
      thread.id
    );
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
  route: "chat/new",
  authLevel: "anonymous",
  handler: createConversation,
});
