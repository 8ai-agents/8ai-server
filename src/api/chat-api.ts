import express from "express";
import assert from "assert";
import OpenAI from "openai";
import { MessageRequest } from "../interfaces/MessageRequest";
import { TextContentBlock } from "openai/resources/beta/threads/messages/messages";

const router = express.Router();
const openai = new OpenAI({
  apiKey: "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",
});
const assistant_id = "asst_tRM0YNhdHurVz0QyGeWgtVQK";

router.get<{}, OpenAI.Beta.Threads.Thread>("/", async (req, res, next) => {
  try {
    const thread = await openai.beta.threads.create();
    res.json(thread);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

router.post("/:thread_id", async (req, res) => {
  try {
    assert("thread_id" in req.params, "Thread ID missing from URL");
    const thread_id = req.params.thread_id as string;
    const message = req.body as MessageRequest;
    await openai.beta.threads.messages.create(thread_id, {
      role: "user",
      content: message.message,
    });

    let run = await openai.beta.threads.runs.create(thread_id, {
      assistant_id,
      instructions: "",
    });

    while (["queued", "in_progress", "cancelling"].includes(run.status)) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for 1 second
      run = await openai.beta.threads.runs.retrieve(run.thread_id, run.id);

      if (run.status === "completed") {
        const messagesResponse = await openai.beta.threads.messages.list(
          run.thread_id
        );
        const content = messagesResponse.data[0].content.find(
          (c) => c.type === "text"
        ) as TextContentBlock;
        res.json(content.text.value);
      } else if (run.status === "failed") {
        console.error(run.last_error);
        res.sendStatus(500);
      }
    }
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

export default router;
