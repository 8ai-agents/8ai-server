import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { MessageRequest } from "../models/MessageRequest";
import { MessageResponse } from "../models/MessageResponse";
import {
  ConversationChannelType,
  MessageCreatorType,
  NewContact,
  NewConversation,
  NewMessage,
} from "../models/Database";
import {
  db,
  saveMessageResponsesToDatabase,
  saveMessagesToDatabase,
} from "../DatabaseController";
import {
  createConversationForOpenAI,
  handleMessageForOpenAI,
} from "../OpenAIHandler";
import { authenticateRequest } from "../AuthController";
import { ConversationsResponse } from "../models/ConversationsResponse";
import { ContactResponse } from "../models/ContactResponse";
import { sendNewConversationAlert } from "../OneSignalHandler";
import {
  AzureKeyCredential,
  EventGridPublisherClient,
  SendEventGridEventInput,
} from "@azure/eventgrid";
import { IPLookupMessageEvent } from "./messageProcessor";

export async function sendMessage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const messageRequest = (await request.json()) as MessageRequest;
    let user_id: string | undefined = undefined;
    let isNewConversation = false;
    if (messageRequest.creator === MessageCreatorType.USER) {
      // We need to retrieve userID from token
      const email = await authenticateRequest(request);
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

    // Check if new conversation or existing?
    if (!messageRequest.conversation_id) {
      if (!messageRequest.organisation_id) {
        return {
          status: 400,
          jsonBody: {
            error:
              "Must supply a valid organisation ID when sending a new message for a new conversation",
          },
        };
      }
      context.log(`Processing message for new conversation`);

      const threadID = await createConversationForOpenAI();
      const newContact = new ContactResponse();
      const newConversation = new ConversationsResponse(
        threadID,
        newContact.name,
        messageRequest.organisation_id
      );
      messageRequest.conversation_id = newConversation.id;

      let ip = request.headers.get("X-Forwarded-For");
      if (ip.includes(":")) {
        ip = ip.split(":")[0];
      }
      // Save to db
      await db
        .insertInto("contacts")
        .values({
          ...newContact,
          organisation_id: messageRequest.organisation_id,
          browser: request.headers.get("user-agent"),
          ip,
          origin: request.headers.get("origin"),
          language_raw: request.headers.get("accept-language"),
          created_at: Date.now(),
        } as NewContact)
        .execute();

      // Message is a Slack Message and is not sent by a bot
      const eventPayload: SendEventGridEventInput<IPLookupMessageEvent>[] = [
        {
          eventType: "Contact.IPLookup",
          subject: `contact/ip_lookup/${newContact.id}`,
          dataVersion: "1.0",
          data: {
            contact_id: newContact.id,
            language_raw: request.headers.get("accept-language"),
            ip,
          },
        },
      ];

      // Publish message to EventGrid
      const topicEndpoint =
        "https://8ai-messaging-topic.australiaeast-1.eventgrid.azure.net/api/events";
      const topicKey = process.env.AZURE_MESSAGE_PROCESSOR_TOPIC_KEY;

      const eventGridClient = new EventGridPublisherClient(
        topicEndpoint,
        "EventGrid",
        new AzureKeyCredential(topicKey)
      );

      try {
        await eventGridClient.send(eventPayload);
      } catch (e) {
        context.error("Error IP update request to queue");
      }

      const converationToSave: NewConversation = {
        id: newConversation.id,
        organisation_id: messageRequest.organisation_id,
        contact_id: newContact.id,
        created_at: newConversation.created_at,
        last_message_at: newConversation.last_message_at,
        status: newConversation.status,
        summary: newConversation.summary,
        sentiment: 0,
        interrupted: false,
        channel: ConversationChannelType.CHAT,
      };
      await db.insertInto("conversations").values(converationToSave).execute();
      isNewConversation = true;
    } else {
      context.log(
        `Processing message for conversation ${messageRequest.conversation_id}`
      );
    }

    // Proceed with processing the message
    const {
      interrupted,
      assistant_id,
      contact_id,
      system_prompt,
      organisation_id,
    } = await db
      .selectFrom("conversations")
      .innerJoin(
        "organisations",
        "conversations.organisation_id",
        "organisations.id"
      )
      .where("conversations.id", "=", messageRequest.conversation_id)
      .select([
        "conversations.id",
        "conversations.organisation_id",
        "conversations.interrupted",
        "organisations.assistant_id",
        "conversations.contact_id",
        "organisations.system_prompt",
      ])
      .executeTakeFirst();

    if (organisation_id !== messageRequest.organisation_id) {
      return {
        status: 400,
        jsonBody: {
          error: "Conversation does not belong to the organisation",
        },
      };
    }

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

      if (isNewConversation) {
        // Send new conversation alert
        await sendNewConversationAlert(
          messageRequest.conversation_id,
          organisation_id,
          context
        );
      }

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
