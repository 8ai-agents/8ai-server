import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import OpenAI from "openai";

export async function getThread(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    context.log(`Creating new thread`);
    const openai = new OpenAI({
      apiKey: "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",
    });
    const thread = await openai.beta.threads.create();
    return { jsonBody: thread };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't generate thread`,
      },
    };
  }
}

app.http("getThread", {
  methods: ["GET"],
  route: "chat",
  authLevel: "anonymous",
  handler: getThread,
});
