import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";
import type { FormDataEntryValue } from "undici";
import { handleMessageForOpenAI, processOpenAIMessage } from "../openAIHandler";
import { MessageCreatorType, NewMessage } from "../models/Database";
import { MessageRequest } from "../models/MessageRequest";
import { MessageResponse } from "../models/MessageResponse";
import { AzureKeyCredential, EventGridPublisherClient } from "@azure/eventgrid";

export async function sendMessageSlack(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  /*
  const org_id = request.params.org_id as string;
  if (!org_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }
  */

  let formData = await request.formData();
  let data: FormDataEntryValue | null = formData.get("text");
  if (data && typeof data == "string") {
    context.log(`Processing message from Slack ${data}`);
    const topicEndpoint =
      "https://&lt;your-event-grid-topic&gt;.&lt;region&gt;-1.eventgrid.azure.net/api/events";
    const topicKey = "8ai-messaging-topic";

    const client = new EventGridPublisherClient(
      topicEndpoint,
      "EventGrid",
      new AzureKeyCredential(topicKey)
    );

    const events = [
      {
        eventType: "MyEvent.Type",
        subject: "MyEvent.Subject",
        dataVersion: "1.0",
        data: {
          message: "Hello, Event Grid!",
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

  return {
    status: 500,
    jsonBody: {
      error: "Failed to send message",
    },
  };
}

app.http("sendMessageSlack", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "/chat/slack",
  handler: sendMessageSlack,
});
