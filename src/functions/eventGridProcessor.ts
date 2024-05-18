import { app, EventGridEvent, InvocationContext } from "@azure/functions";

export async function eventGridProcessor(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  context.log("Event grid function processed event:", event);

  /*
  
    /// Process
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
    */
}

app.eventGrid("eventGridProcessor", {
  handler: eventGridProcessor,
});
