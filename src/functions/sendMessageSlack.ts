import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";
import type { FormDataEntryValue } from "undici";
import { handleMessageForOpenAI } from "../openAIHandler";
import { MessageCreatorType, NewMessage } from "../models/Database";
import { MessageRequest } from "../models/MessageRequest";

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
    const openai = new OpenAI({
      apiKey: process.env.OPEN_API_KEY,
    });
    const thread = await openai.beta.threads.create();
    const assistant_id = "asst_rkDgpBkruW7HZqC0wwesebY2";
    const messageRequest: MessageRequest = {
      conversation_id: thread.id,
      message: data,
      creator: MessageCreatorType.CONTACT,
    };
    const responses = await handleMessageForOpenAI(
      messageRequest,
      assistant_id,
      "",
      context
    );
    return {
      status: 200,
      jsonBody: {
        response_type: "in_channel",
        text: responses.map((r) => r.message).join("\n"),
      },
    };
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
