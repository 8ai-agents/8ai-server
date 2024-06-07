import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  EnvelopedEvent,
  GenericMessageEvent,
  App as SlackApp,
} from "@slack/bolt";
import { db } from "../DatabaseController";
import { SendEventGridEventInput } from "@azure/eventgrid";
import { SlackMessageEvent } from "./messageProcessor";

export async function sendMessageSlackNew(
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

    const slackApp = new SlackApp({
      token: process.env.SLACK_BOT_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
    });

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
    } else if (messageRequest.type === "event_callback") {
      // Message is a Slack Message
      context.log(JSON.stringify(messageRequest));

      const eventPayload: SendEventGridEventInput<SlackMessageEvent>[] = [
        {
          eventType: "Message.Slack",
          subject: `message/slack/${organisation_id}`,
          dataVersion: "1.0",
          data: {
            organisation_id,
            message: JSON.stringify(messageRequest.event.blocks),
            response_url: "",
            user_id: messageRequest.event.user,
            user_name: "",
          },
        },
      ];
      context.log(JSON.stringify(eventPayload));

      await slackApp.client.chat.postMessage({
        channel: messageRequest.event.channel,
        text: "Assistant is thinking...",
      });

      /*
      // Commented out for testing
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
        await eventGridClient.send(events);
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
        };
      }
        */
    }

    /*
  {
  "token": "TOo6qhf6qXrsvF0EFLri6UVK",
  "team_id": "T073VHQKJDA",
  "context_team_id": "T073VHQKJDA",
  "context_enterprise_id": null,
  "api_app_id": "A07680VKG87",
  "event": {
    "user": "U074FT73Z0Q",
    "type": "message",
    "ts": "1717750968.498279",
    "client_msg_id": "98421f2f-2b18-40b4-b548-00dc9d0f2433",
    "text": "<@U077E0H9MRN> try this message",
    "team": "T073VHQKJDA",
    "blocks": [
      {
        "type": "rich_text",
        "block_id": "KRs/H",
        "elements": [
          {
            "type": "rich_text_section",
            "elements": [
              {
                "type": "user",
                "user_id": "U077E0H9MRN"
              },
              {
                "type": "text",
                "text": " try this message"
              }
            ]
          }
        ]
      }
    ],
    "channel": "C073CGYQQH5",
    "event_ts": "1717750968.498279",
    "channel_type": "channel"
  },
  "type": "event_callback",
  "event_id": "Ev076V9GGGDU",
  "event_time": 1717750968,
  "authorizations": [
    {
      "enterprise_id": null,
      "team_id": "T073VHQKJDA",
      "user_id": "U077E0H9MRN",
      "is_bot": true,
      "is_enterprise_install": false
    }
  ],
  "is_ext_shared_channel": false,
  "event_context": "4-eyJldCI6Im1lc3NhZ2UiLCJ0aWQiOiJUMDczVkhRS0pEQSIsImFpZCI6IkEwNzY4MFZLRzg3IiwiY2lkIjoiQzA3M0NHWVFRSDUifQ"
}
  */

    /**let data: FormDataEntryValue | null = formData.get("text");
  if (data && typeof data == "string") {
    context.log(`Processing message from Slack ${data}`);
    const openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY,
    });
    const assistant_id = "asst_rkDgpBkruW7HZqC0wwesebY2";
    const thread = await openai.beta.threads.createAndRunPoll(
      {
        assistant_id,
        instructions: "",
        thread: {
          messages: [
            {
              role: "user",
              content: data,
            },
          ],
        },
      },
      { pollIntervalMs: 300 }
    );
    const messageResponse: MessageResponse[] = [];

    if (thread.status === "completed") {
      const messages = await openai.beta.threads.messages.list(
        thread.thread_id
      );
      for (const message of messages.data.slice(
        0,
        messages.data.findIndex((m) => m.role === "user")
      )) {
        // Gets all messages from the assistant since last user message
        if (message.content[0].type === "text") {
          messageResponse.push(processOpenAIMessage(message, ""));
        }
      }
    } else {
      context.error(thread.status);
      throw new Error("OpenAI request failed");
    }
    return {
      status: 200,
      jsonBody: {
        response_type: "in_channel",
        text: messageResponse.map((r) => r.message).join("\n"),
      },
    };
  }

*/
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
