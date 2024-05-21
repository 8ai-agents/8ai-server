import OpenAI from "openai";
import { MessageRequest } from "./models/MessageRequest";
import { MessageResponse } from "./models/MessageResponse";
import { InvocationContext } from "@azure/functions";
import {
  ConversationStatusType,
  MessageCreatorType,
  NewMessage,
} from "./models/Database";
import { db } from "./DatabaseController";
import { Message } from "openai/resources/beta/threads/messages";

export const handleMessageForOpenAI = async (
  messageRequest: MessageRequest,
  assistant_id: string,
  contact_id: string,
  context: InvocationContext
) => {
  const openai = new OpenAI({
    apiKey: process.env.OPEN_API_KEY,
  });
  const thread_id = messageRequest.conversation_id.replace("conv_", "thread_");
  await openai.beta.threads.messages.create(thread_id, {
    role: "user",
    content: messageRequest.message,
  });

  let run = await openai.beta.threads.runs.createAndPoll(
    thread_id,
    {
      assistant_id,
      instructions: "",
    },
    { pollIntervalMs: 1000 }
  );

  const messageResponse: MessageResponse[] = [];

  if (run.status === "requires_action") {
    context.log(
      `function call detected: ${JSON.stringify(
        run.required_action.submit_tool_outputs
      )}`
    );

    const tool_outputs = run.required_action.submit_tool_outputs.tool_calls.map(
      async (tc) => {
        let output = `{ "success": "true" }`;
        if (tc.function.name === "save_contact_details") {
          output = await saveContactDetails(contact_id, tc.function.arguments);
          context.log(`Save Contact Details: ${output}`);
        }
        return {
          tool_call_id: tc.id,
          output,
        };
      }
    );

    run = await openai.beta.threads.runs.submitToolOutputsAndPoll(
      thread_id,
      run.id,
      {
        tool_outputs: await Promise.all(tool_outputs),
      },
      { pollIntervalMs: 1000 }
    );
  }

  if (run.status === "completed") {
    const messages = await openai.beta.threads.messages.list(run.thread_id);
    for (const message of messages.data.slice(
      0,
      messages.data.findIndex((m) => m.role === "user")
    )) {
      // Gets all messages from the assistant since last user message
      if (message.content[0].type === "text") {
        messageResponse.push(
          await processOpenAIMessage(
            message,
            messageRequest.conversation_id,
            openai
          )
        );
      }
    }
  } else {
    context.error(run.status);
    throw new Error("OpenAI request failed");
  }

  return messageResponse;
};

export const processOpenAIMessage = async (
  message: Message,
  conversation_id: string,
  openai: OpenAI
): Promise<MessageResponse> => {
  if (message.content[0].type === "text") {
    let messageTextContent = message.content[0].text.value;
    if (message.content[0].text.annotations?.length > 0) {
      // there are annotations that we should process
      for (const annotation of message.content[0].text.annotations) {
        /*
        if (annotation.type === "file_citation" && annotation.file_citation) {
          const citedFileContent = await openai.files.content(
            annotation.file_citation.file_id
          );
          console.log(citedFileContent);
        }
        */
        messageTextContent = messageTextContent.replace(annotation.text, "");
      }
    }
    return new MessageResponse(
      conversation_id,
      messageTextContent,
      MessageCreatorType.AGENT,
      message.created_at * 1000
    );
  }
};

/*
for (let annotation of annotations) {
        text.value = text.value.replace(annotation.text, "[" + index + "]");
        const { file_citation } = annotation;
        if (file_citation) {
          const citedFile = await openai.files.retrieve(file_citation.file_id);
          citations.push("[" + index + "]" + citedFile.filename);
        }
        index++;
      }
      */

type SaveContactDetailsPayload = {
  name?: string;
  email?: string;
  phone?: string;
};

const saveContactDetails = async (
  contact_id: string,
  data: string
): Promise<string> => {
  try {
    const details = JSON.parse(data) as SaveContactDetailsPayload;
    await db
      .updateTable("contacts")
      .set({
        name: details.name,
        email: details.email,
        phone: details.phone,
      })
      .where("id", "=", contact_id)
      .execute();
    return JSON.stringify(details);
  } catch (error) {
    return "Can't parse details";
  }
};
