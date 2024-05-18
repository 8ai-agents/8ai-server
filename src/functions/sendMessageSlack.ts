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

export async function sendMessageSlack(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const org_id = request.params.org_id as string;
    if (!org_id) {
      return {
        status: 400,
        jsonBody: {
          error: "Must supply a valid organisation ID",
        },
      };
    }

    let formData = await request.formData();
    let data: FormDataEntryValue | null = formData.get("text");
    let response_url: FormDataEntryValue | null = formData.get("response_url");
    if (
      data &&
      typeof data == "string" &&
      response_url &&
      typeof response_url == "string"
    ) {
      context.log(`Processing message from Slack ${data}`);
      const { assistant_id } = await db
        .selectFrom("organisations")
        .select(["assistant_id"])
        .where("id", "=", org_id)
        .executeTakeFirst();

      const topicEndpoint =
        "https://8ai-messaging-topic.australiaeast-1.eventgrid.azure.net/api/events";
      const topicKey = process.env.MESSAGE_PROCESSOR_TOPIC_KEY;

      const client = new EventGridPublisherClient(
        topicEndpoint,
        "EventGrid",
        new AzureKeyCredential(topicKey)
      );

      const events: SendEventGridEventInput<{
        assistant_id: string;
        message: string;
        response_url: string;
      }>[] = [
        {
          eventType: "Message.Slack",
          subject: `message/slack/${org_id}`,
          dataVersion: "1.0",
          data: {
            assistant_id,
            message: data,
            response_url,
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
        error: "Failed to send message",
      },
    };
  }
}

app.http("sendMessageSlack", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "/chat/slack/{org_id}",
  handler: sendMessageSlack,
});
