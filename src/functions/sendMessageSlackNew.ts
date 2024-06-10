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

export async function sendMessageSlackNew(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const organisation_id = "org_b4de41d6db9d11bfd600eca07e880a3a"; // TODO stop hardcoding
    /*
    const organisation_id = request.params.org_id as string;
    if (!organisation_id) {
      return {
        status: 400,
        jsonBody: {
          error: "Must supply a valid organisation ID",
        },
      };
    }

    // Verify that org has an assistant
    const { assistant_id } = await db
      .selectFrom("organisations")
      .select(["assistant_id"])
      .where("id", "=", organisation_id)
      .executeTakeFirst();
    if (!assistant_id) {
      return {
        status: 500,
        jsonBody: {
          response_type: "in_channel",
          text: "There is no assistant configured for this organisation. Please contact your administrator.",
        },
      };
    }
      */

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
      !messageRequest.event.bot_id &&
      messageRequest.event.user &&
      messageRequest.event.text &&
      messageRequest.event.text
    ) {
      // Message is a Slack Message and is not sent by a bot
      context.log(JSON.stringify(messageRequest));

      const eventPayload: SendEventGridEventInput<SlackBotMessageEvent>[] = [
        {
          eventType: "Message.SlackBot",
          subject: `message/slack/${organisation_id}`,
          dataVersion: "1.0",
          data: {
            organisation_id,
            message: messageRequest.event.text,
            user_id: messageRequest.event.user,
            channel_id: messageRequest.event.channel,
            thread_ts: messageRequest.event.ts,
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

app.http("sendMessageSlackNew", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "/chat/slacknew",
  handler: sendMessageSlackNew,
});
