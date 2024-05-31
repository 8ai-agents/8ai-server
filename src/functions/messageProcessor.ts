import { app, EventGridEvent, InvocationContext } from "@azure/functions";
import { MessageResponse } from "../models/MessageResponse";
import { handleSingleMessageForOpenAI } from "../OpenAIHandler";
import { db, saveMessageResponsesToDatabase } from "../DatabaseController";
import {
  ConversationChannelType,
  ConversationStatusType,
  MessageCreatorType,
  NewContact,
  NewConversation,
  NewMessage,
} from "../models/Database";
import { createID } from "../Utils";

export type SlackMessageEvent = {
  organisation_id: string;
  message: string;
  response_url: string;
  user_id: string;
  user_name: string;
};

export async function messageProcessor(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  if (event.eventType === "Message.Slack") {
    context.log("Incoming Slack Message: ", event);
    await processSlackMessage(event, context);
  } else {
    context.log("Don't know how to process this event: ", event);
  }
}

const processSlackMessage = async (
  event: EventGridEvent,
  context: InvocationContext
) => {
  /// Process
  try {
    const data = event.data as SlackMessageEvent;

    const { assistant_id } = await db
      .selectFrom("organisations")
      .select(["assistant_id"])
      .where("id", "=", data.organisation_id)
      .executeTakeFirst();

    const messageResponse: MessageResponse[] =
      await handleSingleMessageForOpenAI(
        assistant_id,
        data.message.toString(),
        context
      );

    let response = messageResponse.map((r) => r.message).join("\n");
    const citationsWithURLs: string[] = messageResponse
      .flatMap((m) => m.citations && m.citations.map((c) => c.url))
      .filter((c) => c !== undefined && c !== "");
    if (citationsWithURLs.length > 0) {
      // Process citations with URLs
      response += `\n\nThese links might help you:\n${citationsWithURLs.join(
        "\n"
      )}`;
    }
    response +=
      "\nIf this solved your question give the message a :white_check_mark:";

    await postResponseToSlack(data.response_url, response)
      .then(() => context.log("Processed Slack Message"))
      .catch((error) => {
        context.log(error);
      });

    let contact_id: string = createID("cont");
    // Save to db
    const contact = await db
      .selectFrom("contacts")
      .select(["id"])
      .where("slack_id", "=", data.user_id)
      .executeTakeFirst();

    if (contact && contact.id) {
      contact_id = contact.id;
    } else {
      // we need to create a new contact
      const newContact: NewContact = {
        id: contact_id,
        organisation_id: data.organisation_id,
        name: data.user_name,
        slack_id: data.user_id,
      };
      await db.insertInto("contacts").values(newContact).execute();
      contact.id = newContact.id;
    }

    const newConversation: NewConversation = {
      id: createID("conv"),
      organisation_id: data.organisation_id,
      contact_id,
      created_at: Date.now(),
      last_message_at: Date.now(),
      interrupted: false,
      status: ConversationStatusType.OPEN,
      sentiment: 0,
      channel: ConversationChannelType.SLACK,
      channel_id: data.response_url,
    };
    await db.insertInto("conversations").values(newConversation).execute();

    const inboundMessage: NewMessage = {
      id: createID("msg"),
      conversation_id: newConversation.id,
      message: data.message,
      creator: MessageCreatorType.CONTACT,
      version: 1,
      created_at: Date.now(),
    };

    await db.insertInto("messages").values(inboundMessage).execute();
    await saveMessageResponsesToDatabase(messageResponse, false);
  } catch (error) {
    context.error("Error processing Slack message: ", error);
    await postResponseToSlack(
      event.data.response_url.toString(),
      "An error occured wth this message, please contact your adminstrator."
    );
  }
};

const postResponseToSlack = async (response_url: string, response: string) => {
  return fetch(response_url, {
    method: "POST",
    body: JSON.stringify({
      response_type: "in_channel",
      replace_original: true,
      response,
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  });
};

app.eventGrid("messageProcessor", {
  handler: messageProcessor,
});
