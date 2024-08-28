import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { EnvelopedEvent, GenericMessageEvent } from "@slack/bolt";
import {
  AzureKeyCredential,
  EventGridPublisherClient,
  SendEventGridEventInput,
} from "@azure/eventgrid";
import { SlackBotMessageEvent } from "./messageProcessor";
import { db } from "../DatabaseController";

export async function sendMessageSlackBot(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // Process Message
    const messageRequest = (await request.json()) as
      | EnvelopedEvent<GenericMessageEvent>
      | { type: "url_verification"; challenge: string };
    if (messageRequest.type === "url_verification") {
      // Message is a Slack Verification
      return {
        status: 200,
        jsonBody: {
          challenge: messageRequest["challenge"],
        },
      };
    } else if (
      messageRequest.type === "event_callback" &&
      messageRequest.team_id &&
      !messageRequest.event.bot_id &&
      messageRequest.event.user &&
      messageRequest.event.text &&
      messageRequest.event.text &&
      !messageRequest.event.subtype // It's not a system message
    ) {
      // Verify that org has an assistant
      const { organisation_id } = await db
        .selectFrom("organisation_slack")
        .select(["organisation_id"])
        .where("workspace_id", "=", messageRequest.team_id)
        .executeTakeFirst();

      // Look for organisation ID
      if (!organisation_id) {
        return {
          status: 404,
          jsonBody: {
            response_type: "in_channel",
            text: "There is no organisation configured for this Slack Team. Please contact your administrator.",
          },
        };
      }

      context.log(
        `Processing message from SlackBot: ${JSON.stringify(
          messageRequest.event
        )}`
      );

      // Message is a Slack Message and is not sent by a bot
      const eventPayload: SendEventGridEventInput<SlackBotMessageEvent>[] = [
        {
          eventType: "Message.SlackBot",
          subject: `message/slackbot/${organisation_id}`,
          dataVersion: "1.0",
          data: {
            organisation_id,
            message: messageRequest.event.text,
            user_id: messageRequest.event.user,
            channel_id: messageRequest.event.channel,
            thread_ts:
              messageRequest.event.thread_ts || messageRequest.event.ts, // If a reply in a thread, the thread_ts is set and we should use that to identify the thread
          },
        },
      ];

      // Publish message to EventGrid
      const topicEndpoint =
        "https://8ai-messaging-topic.australiaeast-1.eventgrid.azure.net/api/events";
      const topicKey = process.env.MESSAGE_PROCESSOR_TOPIC_KEY;

      const eventGridClient = new EventGridPublisherClient(
        topicEndpoint,
        "EventGrid",
        new AzureKeyCredential(topicKey)
      );

      try {
        await eventGridClient.send(eventPayload);
        return {
          status: 200,
        };
      } catch (error) {
        return {
          status: 500,
        };
      }
    } else {
      context.log(
        `Skipped message from SlackBot: ${JSON.stringify(messageRequest.event)}`
      );
    }
  } catch (e) {
    context.error(e);
    return {
      status: 500,
      jsonBody: {
        error: "Failed to process Slack Message",
      },
    };
  }
}

app.http("sendMessageSlackBot", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "/chat/slackbot",
  handler: sendMessageSlackBot,
});
