import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationResponse } from "../models/ConversationResponse";
import { db, getFullConversation } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";

export async function getConversation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    //const authData = await authenticateRequest(request);
  } catch {
    return { status: 401 };
  }

  const conv_id = request.params.conv_id as string;
  if (!conv_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }
  context.log(`Get Conversation ${conv_id}`);

  try {
    const result = await getFullConversation(conv_id);
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

app.http("getConversation", {
  methods: ["GET"],
  route: "conversations/{conv_id}",
  authLevel: "anonymous",
  handler: getConversation,
});
