import { toFile, AzureOpenAI } from "openai";
import { MessageRequest } from "./models/MessageRequest";
import {
  MessageResponse,
  MessageResponseCitation,
} from "./models/MessageResponse";
import { InvocationContext } from "@azure/functions";
import {
  MessageCreatorType,
  NewOrganisationFile,
  OrganisationFileToUpdate,
} from "./models/Database";
import { db, getFullConversation } from "./DatabaseController";
import { Message } from "openai/resources/beta/threads/messages";
import { Assistant, AssistantTool } from "openai/resources/beta/assistants";
import { Run } from "openai/resources/beta/threads/runs/runs";
import { sendAppErrorAlert, sendContactDetailsAlert } from "./OneSignalHandler";
import { OrganisationFileRequest } from "./models/OrganisationFileRequest";
import { createID } from "./Utils";
import { VectorStoreFile } from "openai/resources/beta/vector-stores/files";

const chosenModel = "gpt-4o-mini";

export const createAzureOpenAIClient = (): AzureOpenAI => {
  const deployment = "8ai-azure-openai";
  const apiVersion = "2024-09-01-preview";
  return new AzureOpenAI({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment,
    apiVersion,
  });
};

export const createConversationForOpenAI = async (): Promise<string> => {
  const openai = createAzureOpenAIClient();
  const thread = await openai.beta.threads.create();
  return thread.id;
};

export const handleMessageForOpenAI = async (
  messageRequest: MessageRequest,
  organisation_id: string,
  assistant_id: string,
  system_prompt: string,
  contact_id: string,
  context: InvocationContext
): Promise<MessageResponse[]> => {
  const openai = createAzureOpenAIClient();
  const thread_id = messageRequest.conversation_id.replace("conv_", "thread_");
  await openai.beta.threads.messages.create(thread_id, {
    role: "user",
    content: messageRequest.message,
  });

  const run = await openai.beta.threads.runs.createAndPoll(
    thread_id,
    {
      assistant_id,
      instructions: system_prompt,
    },
    { pollIntervalMs: 1000 }
  );

  return await handleThreadRun(
    organisation_id,
    thread_id,
    run,
    openai,
    context,
    messageRequest.conversation_id,
    contact_id
  );
};

export const handleSingleMessageForOpenAI = async (
  organisation_id: string,
  assistant_id: string,
  system_prompt: string,
  message: string,
  context: InvocationContext
): Promise<{ thread_id: string; response: MessageResponse[] }> => {
  const openai = createAzureOpenAIClient();
  const run = await openai.beta.threads.createAndRunPoll(
    {
      assistant_id,
      instructions: system_prompt,
      thread: {
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
      },
    },
    { pollIntervalMs: 300 }
  );

  return {
    thread_id: run.thread_id,
    response: await handleThreadRun(
      organisation_id,
      run.thread_id,
      run,
      openai,
      context,
      "",
      undefined
    ),
  };
};

export const processOpenAIMessage = async (
  message: Message,
  conversation_id: string,
  context: InvocationContext
): Promise<MessageResponse> => {
  if (message.content[0].type === "text") {
    let citations: MessageResponseCitation[] | undefined = undefined;
    let messageTextContent = message.content[0].text.value;
    if (message.content[0].text.annotations?.length > 0) {
      // there are annotations that we should process
      for (const annotation of message.content[0].text.annotations) {
        if (annotation.type === "file_citation" && annotation.file_citation) {
          context.log(
            `File citation found for file id ${annotation.file_citation.file_id}`
          );
          try {
            const { name, url } = await db
              .selectFrom("organisation_files")
              .select(["name", "url"])
              .where("id", "=", annotation.file_citation.file_id)
              .executeTakeFirst();

            if (!citations) {
              citations = [];
            }
            const existingCitation = citations.find(
              (c) => c.url === url && c.name === name
            );
            if (existingCitation) {
              // citation already exists, don't add it again
              messageTextContent = messageTextContent.replace(
                annotation.text,
                `【${existingCitation.id}】`
              );
            } else {
              const citation_id = citations.length + 1;
              citations.push({
                id: citation_id,
                name,
                url,
              });
              messageTextContent = messageTextContent.replace(
                annotation.text,
                `【${citation_id}】`
              );
            }
          } catch {
            context.log(
              `Couldn't find file URL for ${annotation.file_citation.file_id}`
            );
            // Can't find the file
            messageTextContent = messageTextContent.replace(
              annotation.text,
              ""
            );
          }
        }
      }
    }
    return new MessageResponse(
      conversation_id,
      messageTextContent,
      MessageCreatorType.AGENT,
      message.created_at * 1000,
      citations
    );
  }
};

export const createAssistant = async (
  organisation_name: string,
  context: InvocationContext
) => {
  const openai = createAzureOpenAIClient();

  try {
    context.log(`Creating new assistant for organisation ${organisation_name}`);
    const myAssistant = await openai.beta.assistants.create({
      name: `8ai-${organisation_name
        .trim()
        .split(" ")
        .join("-")
        .toLowerCase()}`,
      instructions: "",
      model: chosenModel,
      tools: getToolModel(false),
    });

    return myAssistant.id;
  } catch (e) {
    console.error(`Failed to create assistant in OpenAI: ${e.message}`);
    throw "Failed to create AI assistant";
  }
};

export const updateAssistantFile = async (
  organisation_id: string,
  organisation_name: string,
  assistant_id: string,
  newFiles: OrganisationFileRequest[],
  context: InvocationContext
) => {
  const openai = createAzureOpenAIClient();

  try {
    let assistant: Assistant;
    if (assistant_id) {
      assistant = await openai.beta.assistants.retrieve(assistant_id);
      if (assistant.tools?.some((t) => t.type === "file_search")) {
        // Delete existing files attached to this vector store
        for (const vector_store_id of assistant.tool_resources.file_search
          .vector_store_ids) {
          let files = await openai.beta.vectorStores.files.list(
            vector_store_id,
            {
              limit: 100,
            }
          );
          context.log(
            `Deleting files for vector store ${vector_store_id} - deleting ${files.data.length} files`
          );
          while (files.data.length > 0) {
            for (const file of files.data) {
              await openai.files.del(file.id);
              context.log(`Deleted file ${file.id}`);
            }
            files = await openai.beta.vectorStores.files.list(vector_store_id, {
              limit: 100,
            });
          }
          await openai.beta.vectorStores.del(vector_store_id);
          context.log(`Deleted existing vector store ${vector_store_id}`);
        }
      }
    } else {
      // We need to create a new assistant
      context.log(
        `Creating new assistant for organisation ${organisation_name}`
      );
      assistant = await openai.beta.assistants.create({
        name: `8ai-${organisation_name
          .trim()
          .split(" ")
          .join("-")
          .toLowerCase()}`,
        instructions: "",
        model: chosenModel,
        tools: getToolModel(false),
      });
      await db
        .updateTable("organisations")
        .set({ assistant_id: assistant.id })
        .where("id", "=", organisation_id)
        .execute();
    }

    // add new files
    const newOrganisationFiles: NewOrganisationFile[] = [];

    let i = 0;
    // Can only take 500 files here
    context.log(
      `Creating ${newFiles.length} new files for organisation ${organisation_name}`
    );
    for (const newFile of newFiles.slice(0, 500)) {
      try {
        let newDBFile: NewOrganisationFile = {
          ...newFile,
          id: createID("file"),
          created_at: Date.now(),
          updated_at: Date.now(),
          organisation_id: organisation_id,
        };
        newDBFile = await createFile(newDBFile, assistant.id, openai, context);
        newOrganisationFiles.push(newDBFile);
        i++;
        context.log(
          `Created file ${i} of ${newFiles.length} ${newFile.name} for organisation ${organisation_name}`
        );
      } catch {
        context.error(
          `Error creating file ${i} of ${newFiles.length} ${newFile.name} for organisation ${organisation_name}`
        );
      }
    }
    context.log(
      `Created ${newFiles.length} files for organisation ${organisation_name}`
    );

    // create a new vector store with existing files
    const newVectorStore = await openai.beta.vectorStores.create({
      name: `vs_for_${assistant.id}`,
      file_ids: newOrganisationFiles.slice(0, 100).map((f) => f.id),
    });
    context.log(
      `Created vector store for organisation ${organisation_name} - vector store id: ${newVectorStore.id}`
    );

    if (newOrganisationFiles.length > 100) {
      // We have to add new files one by one when more than 100
      for (const extraFile of newOrganisationFiles.slice(100)) {
        await openai.beta.vectorStores.files.create(newVectorStore.id, {
          file_id: extraFile.id,
        });
      }
    }
    context.log(
      `Attached files to new vector store ${newVectorStore.id} for organisation ${organisation_name}`
    );

    await openai.beta.assistants.update(assistant.id, {
      tools: getToolModel(true),
      tool_resources: {
        file_search: {
          vector_store_ids: [newVectorStore.id],
        },
      },
    });
    context.log(
      `Updated assistant ${assistant.id} for organisation ${organisation_name}`
    );
    await db
      .deleteFrom("organisation_files")
      .where("organisation_id", "=", organisation_id)
      .execute();
    await db
      .insertInto("organisation_files")
      .values(newOrganisationFiles)
      .execute();
    context.log(
      `Completed assistant update ${assistant.id} organisation ${organisation_name}`
    );
  } catch (e) {
    throw `Failed to update AI assistant ${e.message}`;
  }
};

type SaveContactDetailsPayload = {
  name?: string;
  email?: string;
  phone?: string;
};

type ReportAppIssuePayload = {
  issue_description: string;
  contact_details?: string;
};

export const handleThreadRun = async (
  organisation_id: string,
  thread_id: string,
  run: Run,
  openai: AzureOpenAI,
  context: InvocationContext,
  conversation_id: string,
  contact_id: string | undefined
) => {
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
        if (tc.function.name === "save_contact_details" && contact_id) {
          output = await saveContactDetails(
            contact_id,
            tc.function.arguments,
            conversation_id,
            context
          );
          context.log(`Save Contact Details: ${output}`);
        }
        if (tc.function.name === "report_application_issue") {
          output = await reportAppIssue(
            organisation_id,
            contact_id,
            tc.function.arguments,
            conversation_id,
            context
          );
          context.log(`Report application issue: ${output}`);
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
    const messages = await openai.beta.threads.messages.list(run.thread_id, {
      limit: 5,
    });
    for (const message of messages.data.slice(
      0,
      messages.data.findIndex((m) => m.role === "user")
    )) {
      // Gets all messages from the assistant since last user message
      if (message.content[0].type === "text") {
        messageResponse.push(
          await processOpenAIMessage(message, conversation_id, context)
        );
      }
    }
  } else {
    context.error(run.status);
    if (run.last_error) {
      context.error(
        `Last error: ${run.last_error.code}: ${run.last_error.message}`
      );
    }
    throw new Error("OpenAI request failed");
  }

  return messageResponse;
};

export const createFile = async (
  newFile: NewOrganisationFile,
  assistant_id: string,
  openai: AzureOpenAI | undefined,
  context: InvocationContext
) => {
  if (!openai) {
    openai = createAzureOpenAIClient();
  }
  try {
    const content: { text: string } = { text: newFile.content };
    const newOpenAIFile = await openai.files.create({
      file: await toFile(
        Buffer.from(JSON.stringify(content)),
        `${assistant_id}-${newFile.id}.json`
      ),
      purpose: "assistants",
    });
    newFile.openai_id = newOpenAIFile.id;
    context.log(
      `Published file ${newFile.id} ${newFile.name} for organisation ${newFile.organisation_id} to OpenAI`
    );
    return newFile;
  } catch {
    context.error(
      `Error creating file ${newFile.id} ${newFile.name} for organisation ${newFile.organisation_id}`
    );
  }
};

export const createFilesAndAttachToVectorStore = async (
  newFiles: NewOrganisationFile[],
  assistant_id: string | undefined,
  organisation_id: string,
  organisation_name: string,
  openai: AzureOpenAI | undefined,
  context: InvocationContext
) => {
  if (!openai) {
    openai = createAzureOpenAIClient();
  }
  // first create files
  for (let newFile of newFiles) {
    try {
      newFile = await createFile(newFile, assistant_id, openai, context);
      context.log(
        `Created file ${
          newFiles.findIndex((f) => f.id === newFile.id) + 1
        } of ${newFiles.length}`
      );
    } catch {
      context.error(`Error creating file ${newFile.id} ${newFile.name}`);
    }
  }

  await attachFileToVectorStore(
    newFiles.map((f) => f.openai_id),
    assistant_id,
    openai,
    organisation_name,
    organisation_id,
    context
  );
  return newFiles;
};

export const createFileAndAttachToVectorStore = async (
  newFile: NewOrganisationFile,
  assistant_id: string | undefined,
  organisation_id: string,
  organisation_name: string,
  openai: AzureOpenAI | undefined,
  context: InvocationContext
) => {
  if (!openai) {
    openai = createAzureOpenAIClient();
  }
  // first create file
  newFile = await createFile(newFile, assistant_id, openai, context);

  await attachFileToVectorStore(
    [newFile.openai_id],
    assistant_id,
    openai,
    organisation_name,
    organisation_id,
    context
  );
  return newFile;
};

export const updateFile = async (
  updateFile: OrganisationFileToUpdate,
  assistant_id: string | undefined,
  organisation_id: string,
  organisation_name: string,
  openai: AzureOpenAI | undefined,
  context: InvocationContext
) => {
  if (!openai) {
    openai = createAzureOpenAIClient();
  }

  if (updateFile.openai_id) {
    // Delete existing
    try {
      await openai.files.del(updateFile.openai_id);
    } catch (e) {
      // We couldn't delete it, that's okay - we can move on and create a new one
      context.warn(
        `Error deleting file with openai ID ${updateFile.openai_id} (internal ID ${updateFile.id})`
      );
      context.warn(JSON.stringify(e));
    }
  }
  updateFile.openai_id = undefined;
  return await createFileAndAttachToVectorStore(
    updateFile,
    assistant_id,
    organisation_id,
    organisation_name,
    openai,
    context
  );
};

export const updateFiles = async (
  updateFiles: OrganisationFileToUpdate[],
  assistant_id: string | undefined,
  organisation_id: string,
  organisation_name: string,
  openai: AzureOpenAI | undefined,
  context: InvocationContext
) => {
  if (!openai) {
    openai = createAzureOpenAIClient();
  }

  // first delete existing files
  for (const updateFile of updateFiles.filter((f) => f.openai_id)) {
    // Delete existing
    try {
      await openai.files.del(updateFile.openai_id);
    } catch (e) {
      // We couldn't delete it, that's okay - we can move on and create a new one
      context.warn(
        `Error deleting file with openai ID ${updateFile.openai_id} (internal ID ${updateFile.id})`
      );
      context.warn(JSON.stringify(e));
    }
    updateFile.openai_id = undefined;
  }

  return await createFilesAndAttachToVectorStore(
    updateFiles,
    assistant_id,
    organisation_id,
    organisation_name,
    openai,
    context
  );
};

export const getVectorStoreFile = async (
  assistant_id: string,
  openAIFileID: string
): Promise<VectorStoreFile> => {
  const openai = createAzureOpenAIClient();
  const assistant = await openai.beta.assistants.retrieve(assistant_id);
  if (assistant.tool_resources.file_search.vector_store_ids.length > 0) {
    return openai.beta.vectorStores.files.retrieve(
      assistant.tool_resources.file_search.vector_store_ids[0],
      openAIFileID
    );
  } else {
    throw new Error("No vector store found");
  }
};

export const resetVectorStoreAndFiles = async (
  assistant_id: string,
  context: InvocationContext
) => {
  const openai = createAzureOpenAIClient();
  const assistant = await openai.beta.assistants.retrieve(assistant_id);
  if (assistant.tools?.some((t) => t.type === "file_search")) {
    // Delete existing files attached to this vector store
    for (const vector_store_id of assistant.tool_resources.file_search
      .vector_store_ids) {
      let files = await openai.beta.vectorStores.files.list(vector_store_id, {
        limit: 100,
      });
      context.log(
        `Deleting files for vector store ${vector_store_id} - deleting ${files.data.length} files`
      );
      while (files.data.length > 0) {
        for (const file of files.data) {
          try {
            await openai.files.del(file.id);
            context.log(`Deleted file ${file.id}`);
          } catch (e) {
            context.warn(`Error deleting file with openai ID ${file.id}`);
            context.warn(JSON.stringify(e));
          }
        }
        files = await openai.beta.vectorStores.files.list(vector_store_id, {
          limit: 100,
        });
      }
      await openai.beta.vectorStores.del(vector_store_id);
      context.log(`Deleted existing vector store ${vector_store_id}`);
    }
  }
};

const saveContactDetails = async (
  contact_id: string,
  data: string,
  conversation_id,
  context
): Promise<string> => {
  try {
    const details = JSON.parse(data) as SaveContactDetailsPayload;
    const existingContact = await db
      .selectFrom("contacts")
      .selectAll()
      .where("id", "=", contact_id)
      .executeTakeFirst();
    if (!existingContact) {
      // create new
      await db
        .insertInto("contacts")
        .values({
          id: contact_id,
          name: details.name,
          email: details.email,
          phone: details.phone,
          created_at: Date.now(),
        })
        .execute();
    } else {
      await db
        .updateTable("contacts")
        .set({
          name: details.name,
          email: details.email,
          phone: details.phone,
        })
        .where("id", "=", contact_id)
        .execute();
    }

    if (
      !existingContact ||
      (!existingContact.email && !existingContact.phone)
    ) {
      // This is the fist time we have seend contact details on this contact
      // Send a new contact notification
      await sendContactDetailsAlert(
        await getFullConversation(conversation_id),
        context
      );
    }

    return JSON.stringify(details);
  } catch {
    return "Can't parse contact details function";
  }
};

const reportAppIssue = async (
  organisation_id: string,
  contact_id: string | undefined,
  data: string,
  conversation_id,
  context
): Promise<string> => {
  try {
    const details = JSON.parse(data) as ReportAppIssuePayload;
    context.log(
      `${
        contact_id || "Anonymous"
      } reported application issue during conversation ${conversation_id}: ${
        details.issue_description
      }`
    );

    // Send email notification to admin users
    await sendAppErrorAlert(
      organisation_id,
      conversation_id,
      details.issue_description,
      details.contact_details,
      context
    );

    return JSON.stringify(details);
  } catch {
    return "Can't parse app issue report details";
  }
};

const attachFileToVectorStore = async (
  file_ids: string[],
  assistant_id: string,
  openai: AzureOpenAI,
  organisation_name: string,
  organisation_id: string,
  context: InvocationContext
) => {
  try {
    let assistant: Assistant;
    if (assistant_id) {
      // retrieve existing assistant
      assistant = await openai.beta.assistants.retrieve(assistant_id);
    } else {
      // We need to create a new assistant
      context.log(
        `Creating new assistant for organisation ${organisation_name}`
      );
      assistant = await openai.beta.assistants.create({
        name: `8ai-${organisation_name
          .trim()
          .split(" ")
          .join("-")
          .toLowerCase()}`,
        instructions: "",
        model: chosenModel,
        tools: getToolModel(false),
      });
      await db
        .updateTable("organisations")
        .set({ assistant_id: assistant.id })
        .where("id", "=", organisation_id)
        .execute();
    }

    // Lets now attach the new file to the vector store
    let vectorStoreID: string =
      assistant.tool_resources?.file_search?.vector_store_ids[0];

    if (!vectorStoreID) {
      // Create new vector store and attach file in one operation
      // create a new vector store with existing files
      const newVectorStore = await openai.beta.vectorStores.create({
        name: `vs_for_${assistant.id}`,
        file_ids,
      });
      context.log(
        `Created vector store for organisation ${organisation_name} - vector store id: ${newVectorStore.id}`
      );
      vectorStoreID = newVectorStore.id;
      await openai.beta.assistants.update(assistant.id, {
        tools: getToolModel(true),
        tool_resources: {
          file_search: {
            vector_store_ids: [newVectorStore.id],
          },
        },
      });
      context.log("Created new vector store and attached files");
    } else {
      // Attach file
      file_ids.forEach(async (file_id) => {
        try {
          await openai.beta.vectorStores.files.create(vectorStoreID, {
            file_id,
          });
        } catch {
          context.error(
            `Error attaching file to vector store ${file_ids} for organisation ${organisation_name}`
          );
          // Clean up
          await openai.files.del(file_id);
        }
      });
      context.log(
        `Attached files to existing vector store ${vectorStoreID} for organisation ${organisation_name}`
      );
    }
  } catch {
    // Clean up
    for (const file_id of file_ids) {
      await openai.files.del(file_id);
    }
  }
};

const getToolModel = (hasFile: boolean): AssistantTool[] => {
  return hasFile
    ? [
        {
          type: "file_search",
          file_search: {
            max_num_results: 5,
          },
        },
        {
          type: "function",
          function: {
            name: "save_contact_details",
            description: "Save contact details of user to database",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The user's name",
                },
                email: {
                  type: "string",
                  description: "The user's email",
                },
                phone: {
                  type: "string",
                  description: "The user's phone number",
                },
              },
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "report_application_issue",
            description:
              "This function should be called when the user reports a major issue or outage with the website or application",
            parameters: {
              type: "object",
              properties: {
                issue_description: {
                  type: "string",
                  description:
                    "A description of the issue, including what happened and how we can reproduce it",
                },
                contact_details: {
                  type: "string",
                  description: "How we can get in contact with the user",
                },
              },
              required: ["issue_description"],
            },
          },
        },
      ]
    : [
        {
          type: "function",
          function: {
            name: "save_contact_details",
            description: "Save contact details of user to database",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The user's name",
                },
                email: {
                  type: "string",
                  description: "The user's email",
                },
                phone: {
                  type: "string",
                  description: "The user's phone number",
                },
              },
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "report_application_issue",
            description:
              "This function should be called when the user reports a major issue or outage with the website or application",
            parameters: {
              type: "object",
              properties: {
                issue_description: {
                  type: "string",
                  description:
                    "A description of the issue, including what happened and how we can reproduce it",
                },
                contact_details: {
                  type: "string",
                  description: "How we can get in contact with the user",
                },
              },
              required: ["issue_description"],
            },
          },
        },
      ];
};
