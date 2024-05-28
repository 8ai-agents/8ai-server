import { InvocationContext } from "@azure/functions";
import { User } from "./models/Database";
import * as OneSignal from "@onesignal/node-onesignal";
import { ConversationResponse } from "./models/ConversationResponse";
import { db } from "./DatabaseController";

const getClient = () => {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_API_KEY,
  });
  return new OneSignal.DefaultApi(configuration);
};

export const sendDailySummary = async (
  conversations: ConversationResponse[],
  users: User[],
  context: InvocationContext
) => {
  const client = getClient();

  for (const user of users.filter((user) => user.email)) {
    const email = new OneSignal.Notification();
    email.app_id = "2962b8af-f3e3-4462-989e-bc983ebaf07a";
    email.include_email_tokens = [user.email];
    email.target_channel = "email";
    email.email_subject = "8ai Daily Conversations Summary";
    email.template_id = "6be607d6-5963-40ef-af7f-134557e49bfd"; // 8ai Daily Conversation Summary
    email.custom_data = {
      user_name: user.name,
      total_count: conversations.length,
      conversations: conversations
        .filter((c) => c.messages?.length > 0)
        .map((conv) => {
          return {
            id: conv.id,
            url: `https://app.8ai.co.nz/conversations/${conv.id}`,
            name: conv.contact.name,
            email: conv.contact.email,
            phone: conv.contact.phone,
            summary: conv.summary,
            sentiment: conv.sentiment,
            message_count: conv.messages.length,
            last_message_at: new Date(conv.last_message_at).toLocaleString(),
          };
        }),
    };

    await client.createNotification(email).then(
      (response) => {
        context.log(response);
        context.log(`Successfully sent daily summary to ${users.length} users`);
      },
      (error) => context.error(error)
    );
  }
};

export const sendNegativeSentimentWarning = async (
  organisation_id: string,
  conversation: ConversationResponse,
  context: InvocationContext
) => {
  const client = getClient();

  const emails = await db
    .selectFrom("users")
    .select(["email"])
    .where("organisation_id", "=", organisation_id)
    .execute();

  const contactDetailsList = [
    conversation.contact.email,
    conversation.contact.phone,
  ].filter((detail) => detail);
  const contact_contact_details =
    contactDetailsList && contactDetailsList.length > 0
      ? contactDetailsList.join(" and ")
      : "No contact details provided";

  const email = new OneSignal.Notification();
  email.app_id = "2962b8af-f3e3-4462-989e-bc983ebaf07a";
  email.include_email_tokens = emails.map((user) => user.email);
  email.target_channel = "email";
  email.email_subject = `Sentiment of conversation with ${conversation.contact.name} is trending negative`;
  email.template_id = "8f0cd5d8-3486-4c60-9d64-755d00fb5e4a"; // 8ai Negative Sentiment Warning
  email.custom_data = {
    id: conversation.id,
    url: `https://app.8ai.co.nz/conversations/${conversation.id}`,
    contact_name: conversation.contact.name,
    contact_contact_details: contact_contact_details,
    summary: conversation.summary,
    sentiment: conversation.sentiment,
    message_count: conversation.messages.length,
    last_message_at: new Date(conversation.last_message_at).toLocaleString(),
    messages: conversation.messages
      .sort((a, b) => a.created_at - b.created_at)
      .map((message) => {
        return {
          creator: message.creator,
          message: message.message,
        };
      }),
  };

  await client.createNotification(email).then(
    (response) => {
      context.log(response);
      context.log(
        `Successfully sent conversation sentiment warning for ${conversation.id}`
      );
    },
    (error) => context.error(error)
  );
};
