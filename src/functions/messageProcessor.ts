import { app, EventGridEvent, InvocationContext } from "@azure/functions";
import { MessageResponse } from "../models/MessageResponse";
import { handleSingleMessageForOpenAI } from "../OpenAIHandler";

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
  const messageResponse: MessageResponse[] = await handleSingleMessageForOpenAI(
    event.data.assistant_id.toString(),
    event.data.message.toString(),
    context
  );

  let text = messageResponse.map((r) => r.message).join("\n");
  const citationsWithURLs: string[] = messageResponse
    .flatMap((m) => m.citations && m.citations.map((c) => c.url))
    .filter((c) => c !== undefined && c !== "");
  if (citationsWithURLs.length > 0) {
    // Process citations with URLs
    text += `\n\nThese links might help you:\n${citationsWithURLs.join("\n")}`;
  }
  text +=
    "\nIf this solved your question give the message a :white_check_mark:";

  await fetch(event.data.response_url.toString(), {
    method: "POST",
    body: JSON.stringify({
      response_type: "in_channel",
      replace_original: true,
      text,
    }),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
    },
  })
    .then(() => context.log("Processed Slack Message"))
    .catch((error) => {
      context.log(error);
    });
};

app.eventGrid("messageProcessor", {
  handler: messageProcessor,
});
