import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { getMessagesForConversation } from "../DatabaseController";

export async function getConversationMessages(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const conv_id = request.params.conv_id as string;
  if (!conv_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }
  context.log(`Get Conversation Messages ${conv_id}`);

  try {
    const result = await getMessagesForConversation(conv_id);
    return { status: 200, jsonBody: result };
  } catch {
    return {
      status: 404,
      jsonBody: {
        error: "Conversation not found",
      },
    };
  }
}

app.http("getConversationMessages", {
  methods: ["GET"],
  route: "conversations/{conv_id}/messages",
  authLevel: "anonymous",
  handler: getConversationMessages,
});
