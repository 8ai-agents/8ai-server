import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { MessageRequest } from "../models/MessageRequest";
import { MessageResponse } from "../models/MessageResponse";
import { MessageCreatorType, NewMessage } from "../models/Database";
import {
  db,
  saveMessageResponsesToDatabase,
  saveMessagesToDatabase,
} from "../DatabaseController";
import { handleMessageForOpenAI } from "../OpenAIHandler";
import { authenticateRequest } from "../AuthController";

export async function sendMessage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const messageRequest = (await request.json()) as MessageRequest;
    let user_id: string | undefined = undefined;
    if (messageRequest.creator === MessageCreatorType.USER) {
      // We need to retrieve userID from token
      const { email } = await authenticateRequest(request);
      if (email) {
        const { id } = await db
          .selectFrom("users")
          .where("email", "=", email)
          .select("id")
          .executeTakeFirst();
        if (id) {
          user_id = id;
        }
      }
    }
    context.log(
      `Processing message for conversation ${messageRequest.conversation_id}`
    );
    const { interrupted, assistant_id, contact_id, system_prompt } = await db
      .selectFrom("conversations")
      .innerJoin(
        "organisations",
        "conversations.organisation_id",
        "organisations.id"
      )
      .where("conversations.id", "=", messageRequest.conversation_id)
      .select([
        "conversations.id",
        "conversations.interrupted",
        "organisations.assistant_id",
        "conversations.contact_id",
        "organisations.system_prompt",
      ])
      .executeTakeFirst();

    const newMessageRequest: NewMessage = {
      ...new MessageResponse(
        messageRequest.conversation_id,
        messageRequest.message,
        messageRequest.creator
      ),
      created_at: Date.now(),
      user_id,
      citations: undefined,
    };

    await saveMessagesToDatabase(
      [newMessageRequest],
      interrupted || messageRequest.creator === "USER"
    );

    if (interrupted || messageRequest.creator === "USER") {
      // interrupted by a user, AI should not process this message
      return {
        status: 200,
        jsonBody: [],
      };
    } else {
      const responses = await handleMessageForOpenAI(
        messageRequest,
        assistant_id,
        system_prompt,
        contact_id,
        context
      );

      // Save message to database
      await saveMessageResponsesToDatabase(responses, false);

      return {
        status: 200,
        jsonBody: responses,
      };
    }
  } catch (error) {
    context.error(`Error sending message: ${error}`);

    return {
      status: 500,
      jsonBody: {
        error: "Failed to send message",
      },
    };
  }
}

app.http("sendMessage", {
  methods: ["POST", "OPTIONS"],
  route: "chat",
  authLevel: "anonymous",
  handler: sendMessage,
});
