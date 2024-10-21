import { app, EventGridEvent, InvocationContext } from "@azure/functions";
import { MessageResponse } from "../models/MessageResponse";
import {
  handleMessageForOpenAI,
  handleSingleMessageForOpenAI as handleNewMessageForOpenAI,
} from "../OpenAIHandler";
import { db, saveMessageResponsesToDatabase } from "../DatabaseController";
import {
  Conversation,
  ConversationChannelType,
  ConversationStatusType,
  MessageCreatorType,
  NewContact,
  NewConversation,
  NewMessage,
} from "../models/Database";
import { createID } from "../Utils";
import { UsersInfoResponse } from "@slack/web-api";
import { sendNewConversationAlert } from "../OneSignalHandler";

export type SlackSlashMessageEvent = {
  organisation_id: string;
  message: string;
  response_url: string;
  user_id: string;
  user_name: string;
};

export type SlackBotMessageEvent = {
  organisation_id: string;
  message: string;
  user_id: string;
  channel_id: string;
  thread_ts: string;
};

export type IPLookupMessageEvent = {
  contact_id: string;
  ip: string;
  language_raw: string;
};

export async function messageProcessor(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  if (event.eventType === "Message.Slack") {
    // This is for a slash command
    context.log("Incoming Slack Slash Command Message: ", event);
    await processSlackSlashMessage(event, context);
  } else if (event.eventType === "Message.SlackBot") {
    // This is for a bot message
    context.log("Incoming SlackBot Message: ", event);
    await processSlackBotMessage(event, context);
  } else if (event.eventType === "Contact.IPLookup") {
    // This is for an IP lookup request
    context.log("Incoming IP Lookup Request Message: ", event);
    await processIPLookupMessage(event, context);
  } else {
    context.log("Don't know how to process this event: ", event);
  }
}

const processSlackBotMessage = async (
  event: EventGridEvent,
  context: InvocationContext
) => {
  const { bot_token, internal_user_list } = await db
    .selectFrom("organisation_slack")
    .select(["bot_token", "internal_user_list"])
    .where("organisation_id", "=", event.data.organisation_id.toString())
    .executeTakeFirst();

  try {
    const data = event.data as SlackBotMessageEvent;

    // Fetch channel name using the channel ID
    const channelInfo = await fetch(
      `https://slack.com/api/conversations.info?channel=${data.channel_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${bot_token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    ).then((res) => res.json());

    const channelName = channelInfo.channel.name;

    // Check if the channel name includes "alignment"
    // TODO use channel ID rather than name
    if (channelName.includes("alignment")) {
      context.log("Channel includes 'alignment'. Modifying message.");
      data.message += " [Modified because this is an alignment channel]";
    }

    const { assistant_id, system_prompt } = await db
      .selectFrom("organisations")
      .select(["assistant_id", "system_prompt"])
      .where("id", "=", data.organisation_id)
      .executeTakeFirst();

    // Get user name from Slack API
    const slackUser = await getUserFromSlack(data.user_id, bot_token, context);
    let user_id: string | undefined = undefined;

    // Check if sent by an internal user ID, or has an internal user ID tagged, and mark interrupted if so
    let shouldInterruptConversation = false;
    if (
      internal_user_list &&
      (internal_user_list.split(",").includes(data.user_id) ||
        internal_user_list
          .split(",")
          .some((id) => data.message.includes(`<@${id}>`)))
    ) {
      context.log(
        `Ignoring message from internal user: ${data.user_id} ${slackUser.real_name} ${slackUser.profile?.email}`
      );

      // Interrupt the conversation
      shouldInterruptConversation = true;

      if (slackUser.profile?.email) {
        // Try get user ID
        const user = await db
          .selectFrom("users")
          .select(["id"])
          .where("email", "=", slackUser.profile?.email.toLowerCase())
          .executeTakeFirst();
        if (user && user.id) {
          user_id = user.id;
        }
      }
    }

    const contact_id = await checkGetContactID(
      slackUser.id,
      slackUser.real_name,
      slackUser.profile?.email,
      slackUser.profile?.phone,
      data.organisation_id
    );

    let existingConversationID = "";
    let isNewConversation = false;
    const existingConversation = await checkGetConversationUsingSlackThreadID(
      data.thread_ts,
      user_id
    );

    if (existingConversation && existingConversation.id) {
      existingConversationID = existingConversation.id;
      // TODO temp fix here, we should instead allow normal users to have a conversation
      shouldInterruptConversation = true;
      // shouldInterruptConversation = shouldInterruptConversation || existingConversation.interrupted;

      if (shouldInterruptConversation) {
        // Update the conversation to mark it as interrupted
        await db
          .updateTable("conversations")
          .set({ interrupted: true })
          .where("id", "=", existingConversationID)
          .execute();
      }
    } else {
      isNewConversation = true;
    }

    let messageResponse: MessageResponse[] | undefined = undefined;

    if (shouldInterruptConversation) {
      context.log("Conversation was interrupted, not responding");
    } else {
      // We only answer the message if the message sender is not an admin
      if (existingConversationID) {
        // We are continuing a conversation
        const openAIResponseData = await handleMessageForOpenAI(
          {
            organisation_id: data.organisation_id,
            conversation_id: existingConversationID,
            message: data.message.toString(),
            creator: MessageCreatorType.CONTACT,
            referrer: `Slackbot-${channelName}`,
          },
          data.organisation_id,
          assistant_id,
          system_prompt,
          contact_id,
          context
        );
        messageResponse = openAIResponseData;
      } else {
        // We are starting a new one
        const openAIResponseData = await handleNewMessageForOpenAI(
          data.organisation_id,
          assistant_id,
          system_prompt,
          data.message.toString(),
          context
        );
        messageResponse = openAIResponseData.response;
        existingConversationID = openAIResponseData.thread_id.replace(
          "thread_",
          "conv_"
        );
        // Save new conversation with correct OpenAI thread ID
        const newConversation: NewConversation = {
          id: existingConversationID,
          organisation_id: data.organisation_id,
          contact_id,
          created_at: Date.now(),
          last_message_at: Date.now(),
          interrupted: false,
          status: ConversationStatusType.OPEN,
          sentiment: 0,
          channel: ConversationChannelType.SLACK,
          channel_id: data.thread_ts,
        };
        await db.insertInto("conversations").values(newConversation).execute();
      }
      let response = messageResponse.map((r) => r.message).join("\n");
      const citationsWithURLs: string[] = messageResponse
        .flatMap((m) => m.citations && m.citations.map((c) => c.url))
        .filter((c) => c !== undefined && c !== "");
      if (citationsWithURLs.length > 0) {
        // Process citations with URLs
        response += `\n\nThese links might help you:\n${citationsWithURLs.join(
          "\n"
        )}`;
      }
      response +=
        "\nIf this solved your question give the message a :white_check_mark:";

      await postBotResponseToSlack(
        {
          channel: data.channel_id,
          text: response,
          thread_ts: data.thread_ts,
        },
        bot_token,
        context
      );
    }

    if (existingConversationID) {
      // We only save the inbound message if the conversation exists
      const inboundMessage: NewMessage = {
        id: createID("msg"),
        conversation_id: existingConversationID,
        message: data.message,
        creator: slackUser.is_admin
          ? MessageCreatorType.USER
          : MessageCreatorType.CONTACT,
        version: 1,
        created_at: Date.now(),
        user_id,
      };

      await db.insertInto("messages").values(inboundMessage).execute();
      if (messageResponse) {
        for (const [index, mr] of messageResponse.entries()) {
          mr.conversation_id = existingConversationID;
          mr.created_at = inboundMessage.created_at + index + 1;
        }
        await saveMessageResponsesToDatabase(messageResponse, false);
      }
    }

    if (isNewConversation) {
      // Send new conversation alert
      await sendNewConversationAlert(
        existingConversationID,
        data.organisation_id,
        context
      );
    }
  } catch (error) {
    context.error("Error processing Slack message: ", error);
    await postBotResponseToSlack(
      {
        channel: event.data.channel_id.toString(),
        text: "An error occured wth this message, please contact your adminstrator.",
        thread_ts: event.data.thread_ts.toString(),
      },
      bot_token,
      context
    );
  }
};

const processSlackSlashMessage = async (
  event: EventGridEvent,
  context: InvocationContext
) => {
  /// Process
  try {
    const data = event.data as SlackSlashMessageEvent;

    const { assistant_id, system_prompt } = await db
      .selectFrom("organisations")
      .select(["assistant_id", "system_prompt"])
      .where("id", "=", data.organisation_id)
      .executeTakeFirst();

    const openAIResponseData = await handleNewMessageForOpenAI(
      data.organisation_id,
      assistant_id,
      system_prompt,
      data.message.toString(),
      context
    );

    let response = openAIResponseData.response.map((r) => r.message).join("\n");
    const citationsWithURLs: string[] = openAIResponseData.response
      .flatMap((m) => m.citations && m.citations.map((c) => c.url))
      .filter((c) => c !== undefined && c !== "");
    if (citationsWithURLs.length > 0) {
      // Process citations with URLs
      response += `\n\nThese links might help you:\n${citationsWithURLs.join(
        "\n"
      )}`;
    }
    response +=
      "\nIf this solved your question give the message a :white_check_mark:";

    await postSlashResponseToSlack(data.response_url, response, context);

    const contact_id = await checkGetContactID(
      data.user_id,
      data.user_name,
      "",
      "",
      data.organisation_id
    );

    // Update conversation
    let conversation_id = "";
    const existingConversation = await checkGetConversationUsingSlackThreadID(
      data.response_url,
      undefined
    );
    if (existingConversation && existingConversation.id) {
      conversation_id = existingConversation.id;
    }

    if (!conversation_id) {
      // Save new conversation with correct OpenAI thread ID
      conversation_id = openAIResponseData.thread_id.replace(
        "thread_",
        "conv_"
      );
      const newConversation: NewConversation = {
        id: conversation_id,
        organisation_id: data.organisation_id,
        contact_id,
        created_at: Date.now(),
        last_message_at: Date.now(),
        interrupted: false,
        status: ConversationStatusType.OPEN,
        sentiment: 0,
        channel: ConversationChannelType.SLACK,
        channel_id: data.response_url,
      };
      await db.insertInto("conversations").values(newConversation).execute();
    }

    const inboundMessage: NewMessage = {
      id: createID("msg"),
      conversation_id,
      message: data.message,
      creator: MessageCreatorType.CONTACT,
      version: 1,
      created_at: Date.now(),
    };

    for (const [index, mr] of openAIResponseData.response.entries()) {
      mr.conversation_id = conversation_id;
      mr.created_at = inboundMessage.created_at + index + 1;
    }

    await db.insertInto("messages").values(inboundMessage).execute();
    await saveMessageResponsesToDatabase(openAIResponseData.response, false);
  } catch (error) {
    context.error("Error processing Slack message: ", error);
    await postSlashResponseToSlack(
      event.data.response_url.toString(),
      "An error occured wth this message, please contact your adminstrator.",
      context
    );
  }
};

const processIPLookupMessage = async (
  event: EventGridEvent,
  context: InvocationContext
) => {
  try {
    const data = event.data as IPLookupMessageEvent;
    let location_estimate_string: string;
    let location_estimate_lat: string;
    let location_estimate_lon: string;
    let language: string;

    if (data.ip) {
      // Process IP address
      try {
        context.log(`Looking up ip information for ${data.ip}`);
        const ipLookupResponse = await fetch(
          `https://ipinfo.io/${data.ip}?token=3e1f700c372e45`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!ipLookupResponse.ok) {
          throw new Error(
            `Failed to fetch IP info: ${ipLookupResponse.statusText}`
          );
        }

        const ipInfo: {
          ip: string;
          hostname: string;
          city: string;
          region: string;
          country: string;
          loc: string;
          org: string;
          postal: string;
          timezone: string;
        } = await ipLookupResponse.json();

        location_estimate_string = [
          ipInfo.city,
          ipInfo.region,
          ipInfo.postal,
          ipInfo.country,
        ]
          .filter((l) => l)
          .join(", ");
        if (ipInfo.loc && ipInfo.loc.split(",").length === 2) {
          location_estimate_lat = ipInfo.loc.split(",")[0];
          location_estimate_lon = ipInfo.loc.split(",")[1];
        }

        context.log(
          `Parsed IP Info for ${data.contact_id}: ${location_estimate_string}`
        );
      } catch (error) {
        context.error(`Error parsing IP location for ${data.contact_id}`);
        context.error(error);
      }
    }

    if (data.language_raw) {
      // Try deconstruct languages
      try {
        context.log(`Parsing language ${data.language_raw}`);
        const languageNames = new Intl.DisplayNames(["en"], {
          type: "language",
        });
        if (data.language_raw.includes(",")) {
          if (data.language_raw.split(",")[0].includes(";")) {
            language = languageNames.of(
              data.language_raw.split(",")[0].split(";")[0]
            );
          } else {
            language = languageNames.of(data.language_raw.split(",")[0]);
          }
        } else {
          if (data.language_raw.includes(";")) {
            language = languageNames.of(data.language_raw.split(";")[0]);
          } else {
            language = languageNames.of(data.language_raw);
          }
        }
        context.log(`Parsed clean language ${data.contact_id}: ${language}`);
      } catch (error) {
        context.error(`Error parsing clean language for  ${data.contact_id}`);
        context.error(error);
      }
    }
    // Save data
    await db
      .updateTable("contacts")
      .set({
        language,
        location_estimate_string,
        location_estimate_lat,
        location_estimate_lon,
      })
      .where("id", "=", data.contact_id)
      .execute();
  } catch (error) {
    context.error(`Error processing IP Lookup message: `, error);
    await postSlashResponseToSlack(
      event.data.response_url.toString(),
      "An error occured wth this message, please contact your adminstrator.",
      context
    );
  }
};

const postBotResponseToSlack = async (
  data: {
    channel: string;
    text: string;
    thread_ts: string;
  },
  slack_bot_token: string,
  context: InvocationContext
) => {
  return await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    body: JSON.stringify(data),
    headers: {
      "Content-type": "application/json",
      Authorization: `Bearer ${slack_bot_token}`,
    },
  })
    .then(() => context.log("Processed Slack Message"))
    .catch((error) => {
      context.log(error);
      throw error;
    });
};

const postSlashResponseToSlack = async (
  response_url: string,
  text: string,
  context: InvocationContext
) => {
  return await fetch(response_url, {
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
      throw error;
    });
};

const getUserFromSlack = async (
  user_id: string,
  slack_bot_token: string,
  context: InvocationContext
) => {
  return await fetch("https://slack.com/api/users.info", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${slack_bot_token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `user=${user_id}`,
  })
    .then(async (response) => await response.json())
    .then(async (response: UsersInfoResponse) =>
      response.ok && response.user
        ? response.user
        : Promise.reject(response.error)
    )
    .catch((error) => {
      context.log(error);
      throw error;
    });
};

const checkGetContactID = async (
  slack_id: string,
  slack_name: string,
  slack_email: string,
  slack_phone: string,
  organisation_id: string
) => {
  // First check if there is an existing contact and conversation
  let contact_id: string = createID("cont");
  const contact = await db
    .selectFrom("contacts")
    .select(["id"])
    .where("slack_id", "=", slack_id)
    .executeTakeFirst();

  if (contact && contact.id) {
    contact_id = contact.id;
  } else {
    // we need to create a new contact
    const newContact: NewContact = {
      id: contact_id,
      organisation_id,
      name: slack_name,
      email: slack_email,
      phone: slack_phone,
      slack_id: slack_id,
      created_at: Date.now(),
    };
    await db.insertInto("contacts").values(newContact).execute();
  }
  return contact_id;
};

const checkGetConversationUsingSlackThreadID = async (
  thread_ts: string,
  user_id: string | undefined
): Promise<Conversation> => {
  const conversation = await db
    .selectFrom("conversations")
    .selectAll()
    .where("channel_id", "=", thread_ts)
    .executeTakeFirst();

  if (conversation && conversation.id) {
    if (user_id) {
      // Set the interrupted flag to true
      conversation.interrupted = true;
      conversation.assignee_id = user_id;
      await db
        .updateTable("conversations")
        .set(conversation)
        .where("id", "=", conversation.id)
        .executeTakeFirst();
    }
  }
  return conversation;
};

app.eventGrid("messageProcessor", {
  handler: messageProcessor,
});
