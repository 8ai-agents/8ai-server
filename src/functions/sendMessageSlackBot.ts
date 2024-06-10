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
      messageRequest.event.text
    ) {
      // Verify that org has an assistant
      const { id, assistant_id } = await db
        .selectFrom("organisations")
        .select(["id", "assistant_id"])
        .where("slack_team_id", "=", messageRequest.team_id)
        .executeTakeFirst();
      if (!id) {
        return {
          status: 404,
          jsonBody: {
            response_type: "in_channel",
            text: "There is no organisation configured for this Slack Team. Please contact your administrator.",
          },
        };
      }
      if (!assistant_id) {
        return {
          status: 500,
          jsonBody: {
            response_type: "in_channel",
            text: "There is no assistant configured for this organisation. Please contact your administrator.",
          },
        };
      }
      // Message is a Slack Message and is not sent by a bot
      const eventPayload: SendEventGridEventInput<SlackBotMessageEvent>[] = [
        {
          eventType: "Message.SlackBot",
          subject: `message/slackbot/${id}`,
          dataVersion: "1.0",
          data: {
            organisation_id: id,
            message: messageRequest.event.text,
            user_id: messageRequest.event.user,
            channel_id: messageRequest.event.channel,
            thread_ts:
              messageRequest.event.thread_ts || messageRequest.event.ts, // If a reply in a thread, the thread_ts is set and we should use that to identify the thread
          },
        },
      ];
      context.log(JSON.stringify(eventPayload));

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
