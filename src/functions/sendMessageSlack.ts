import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import type { FormDataEntryValue } from "undici";
import {
  AzureKeyCredential,
  EventGridPublisherClient,
  SendEventGridEventInput,
} from "@azure/eventgrid";
import { db } from "../DatabaseController";
import { SlackMessageEvent } from "./messageProcessor";

export async function sendMessageSlack(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const organisation_id = request.params.org_id as string;
    if (!organisation_id) {
      return {
        status: 400,
        jsonBody: {
          error: "Must supply a valid organisation ID",
        },
      };
    }

    // Get data
    const formData = await request.formData();
    const messageText: FormDataEntryValue | null = formData.get("text");
    const response_url: FormDataEntryValue | null =
      formData.get("response_url");
    const user_name: FormDataEntryValue | null = formData.get("user_name");
    const user_id: FormDataEntryValue | null = formData.get("user_id");

    // Process
    if (
      messageText &&
      typeof messageText == "string" &&
      response_url &&
      typeof response_url == "string" &&
      user_name &&
      typeof user_name == "string" &&
      user_id &&
      typeof user_name == "string"
    ) {
      context.log(`Processing message from Slack ${messageText}`);

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

      // Publish message to EventGrid
      const topicEndpoint =
        "https://8ai-messaging-topic.australiaeast-1.eventgrid.azure.net/api/events";
      const topicKey = process.env.MESSAGE_PROCESSOR_TOPIC_KEY;

      const client = new EventGridPublisherClient(
        topicEndpoint,
        "EventGrid",
        new AzureKeyCredential(topicKey)
      );

      const events: SendEventGridEventInput<SlackMessageEvent>[] = [
        {
          eventType: "Message.Slack",
          subject: `message/slack/${organisation_id}`,
          dataVersion: "1.0",
          data: {
            organisation_id,
            message: messageText,
            response_url,
            user_id: user_name,
            user_name,
          },
        },
      ];

      try {
        await client.send(events);
        return {
          status: 200,
          jsonBody: {
            response_type: "in_channel",
            text: "Assistant is thinking...",
          },
        };
      } catch (error) {
        return {
          status: 500,
          jsonBody: {
            response_type: "in_channel",
            text: "Assistant is thinking...",
          },
        };
      }
    }
    throw new Error("Can't parse Slack message");
  } catch (e) {
    context.error(e);
    return {
      status: 500,
      jsonBody: {
        error: "The Slack message could not be parsed",
      },
    };
  }
}

app.http("sendMessageSlack", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "/chat/slack/{org_id}",
  handler: sendMessageSlack,
});
