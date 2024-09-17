import { InvocationContext } from "@azure/functions";
import {
  NotificationSettingsType,
  User,
  UserRoleType,
} from "./models/Database";
import * as OneSignal from "@onesignal/node-onesignal";
import { ConversationResponse } from "./models/ConversationResponse";
import { db } from "./DatabaseController";
import { format } from "timeago.js";
import { ConversationsResponse } from "./models/ConversationsResponse";

const getClient = () => {
  // Create formatter (English).
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
  const oneSignal = getClient();

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
        .map((conversation) => {
          return {
            id: conversation.id,
            url: `https://app.8ai.co.nz/conversations/${conversation.id}`,
            name: conversation.contact.name,
            email: conversation.contact.email,
            phone: conversation.contact.phone,
            summary: conversation.summary,
            sentiment: conversation.sentiment,
            message_count: conversation.messages.length,
            last_message_at: format(new Date(conversation.last_message_at)),
          };
        }),
    };

    await oneSignal.createNotification(email).then(
      (response) => {
        context.log(response);
        context.log(`Successfully sent daily summary to ${users.length} users`);
      },
      (error) => context.error(error)
    );
  }
};

export const sendDailySummaryToSuperAdmins = async (
  conversations: ConversationsResponse[],
  superAdmins: {
    id: string;
    organisation_id: string;
    name: string;
    email: string;
    role: UserRoleType;
  }[],
  organisations: { id: string; name: string }[],
  context: InvocationContext
) => {
  const oneSignal = getClient();

  const organisationsData: {
    id: string;
    name: string;
    total_count: number;
    conversations: {
      id: string;
      url: string;
      name: string;
      summary: string;
      sentiment: number;
      last_message_at: string;
    }[];
  }[] = [];

  for (const org of organisations) {
    if (conversations.some((c) => c.organisation_id === org.id)) {
      const orgConversations = conversations.filter(
        (c) => c.organisation_id === org.id
      );
      organisationsData.push({
        id: org.id,
        name: org.name,
        total_count: orgConversations.length,
        conversations: orgConversations.map((conversation) => {
          return {
            id: conversation.id,
            url: `https://app.8ai.co.nz/conversations/${conversation.id}`,
            name: conversation.contact_name,
            summary: conversation.summary,
            sentiment: conversation.sentiment,
            last_message_at: format(new Date(conversation.last_message_at)),
          };
        }),
      });
    }
  }

  const email = new OneSignal.Notification();
  email.app_id = "2962b8af-f3e3-4462-989e-bc983ebaf07a";
  email.include_email_tokens = superAdmins
    .filter((user) => user.email)
    .map((user) => user.email);
  email.target_channel = "email";
  email.email_subject = "8ai Super Admin Daily Conversations Summary";
  email.template_id = "0129c557-6403-43f8-bf53-f8e806769ce9"; // 8ai Daily Conversation Summary Super Admins
  email.custom_data = {
    total_count: conversations.length,
    organisations: organisationsData,
  };

  await oneSignal.createNotification(email).then(
    (response) => {
      context.log(response);
      context.log(
        `Successfully sent daily summary to ${superAdmins.length} users`
      );
    },
    (error) => context.error(error)
  );
};

export const sendNegativeSentimentWarning = async (
  conversation: ConversationResponse,
  context: InvocationContext
) => {
  // We fist check if any user is subscribed to negative sentiment warnings
  const emails = await db
    .selectFrom("users")
    .select(["users.email"])
    .leftJoin(
      "notification_settings",
      "notification_settings.user_id",
      "users.id"
    )
    .leftJoin("user_roles", "user_roles.user_id", "users.id")
    .where("user_roles.organisation_id", "=", conversation.organisation_id)
    .where(
      "notification_settings.type",
      "=",
      NotificationSettingsType.NEGATIVE_SENTIMENT
    )
    .where("notification_settings.enabled", "=", true)
    .execute();

  if (emails.length > 0) {
    // There is at least someone to send the notification to
    const oneSignal = getClient();

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
      last_message_at: format(new Date(conversation.last_message_at)),
      messages: conversation.messages
        .sort((a, b) => a.created_at - b.created_at)
        .map((message) => {
          return {
            creator: message.creator,
            message: message.message,
          };
        }),
    };

    await oneSignal.createNotification(email).then(
      (response) => {
        context.log(response);
        context.log(
          `Successfully sent conversation sentiment warning for ${conversation.id}`
        );
      },
      (error) => context.error(error)
    );
  }
};

export const sendContactDetailsAlert = async (
  conversation: ConversationResponse,
  context: InvocationContext
) => {
  // We fist check if any user is subscribed to contact details left warnings
  const emails = await db
    .selectFrom("users")
    .select(["users.email"])
    .leftJoin(
      "notification_settings",
      "notification_settings.user_id",
      "users.id"
    )
    .leftJoin("user_roles", "user_roles.user_id", "users.id")
    .where("user_roles.organisation_id", "=", conversation.organisation_id)
    .where(
      "notification_settings.type",
      "=",
      NotificationSettingsType.CONTACT_DETAILS_LEFT
    )
    .where("notification_settings.enabled", "=", true)
    .execute();

  if (emails.length > 0) {
    // There is at least someone to send the notification to
    const oneSignal = getClient();

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
    email.email_subject = `${conversation.contact.name} has left their contact details for you`;
    email.template_id = "b8083b4d-d27f-45db-8e2c-82e15b7a3adb"; // 8ai New Contact Details Left
    email.custom_data = {
      id: conversation.id,
      url: `https://app.8ai.co.nz/conversations/${conversation.id}`,
      channel: conversation.channel,
      contact_name: conversation.contact.name,
      contact_contact_details: contact_contact_details,
      message_count: conversation.messages.length,
      last_message_at: format(new Date(conversation.last_message_at)),
      messages: conversation.messages
        .sort((a, b) => a.created_at - b.created_at)
        .map((message) => {
          return {
            creator: message.creator,
            message: message.message,
          };
        }),
    };

    await oneSignal.createNotification(email).then(
      (response) => {
        context.log(response);
        context.log(
          `Successfully sent conversation sentiment warning for ${conversation.id}`
        );
      },
      (error) => context.error(error)
    );
  }
};

export const sendNewConversationAlert = async (
  conversation: ConversationResponse,
  context: InvocationContext
) => {
  // We fist check if any user is subscribed to new conversation warnings
  const emails = await db
    .selectFrom("users")
    .select(["users.email"])
    .leftJoin(
      "notification_settings",
      "notification_settings.user_id",
      "users.id"
    )
    .leftJoin("user_roles", "user_roles.user_id", "users.id")
    .where("user_roles.organisation_id", "=", conversation.organisation_id)
    .where(
      "notification_settings.type",
      "=",
      NotificationSettingsType.NEW_CONVERSATION
    )
    .where("notification_settings.enabled", "=", true)
    .execute();

  if (emails.length > 0) {
    // There is at least someone to send the notification to
    const oneSignal = getClient();

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
    email.email_subject = `New conversation with ${conversation.contact.name} over ${conversation.channel}`;
    email.template_id = "3ba3aa30-3333-4d2b-9de9-76dda85d3972"; // 8ai New Conversation Warning
    email.custom_data = {
      id: conversation.id,
      url: `https://app.8ai.co.nz/conversations/${conversation.id}`,
      contact_name: conversation.contact.name,
      contact_contact_details: contact_contact_details,
      message_count: conversation.messages.length,
      last_message_at: format(new Date(conversation.last_message_at)),
      messages: conversation.messages
        .sort((a, b) => a.created_at - b.created_at)
        .map((message) => {
          return {
            creator: message.creator,
            message: message.message,
          };
        }),
    };

    await oneSignal.createNotification(email).then(
      (response) => {
        context.log(response);
        context.log(
          `Successfully sent conversation sentiment warning for ${conversation.id}`
        );
      },
      (error) => context.error(error)
    );
  }
};
