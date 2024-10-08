import { app, InvocationContext, Timer } from "@azure/functions";
import { db, getFullConversation } from "../DatabaseController";
import {
  ConversationStatusType,
  NotificationSettingsType,
  UserRoleType,
} from "../models/Database";
import {
  sendDailySummary,
  sendDailySummaryToSuperAdmins,
} from "../OneSignalHandler";
import { ConversationsResponse } from "../models/ConversationsResponse";

export async function cronDailyMessageSummaries(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Sending Daily Message Summaries");

  const oneDayAgo: number = Date.now() - 1000 * 60 * 60 * 24; // More than 24 hours ago

  const allAdmins = await db
    .selectFrom("users")
    .leftJoin(
      "notification_settings",
      "users.id",
      "notification_settings.user_id"
    )
    .leftJoin("user_roles", "user_roles.user_id", "users.id")
    .select([
      "users.id",
      "users.name",
      "users.email",
      "user_roles.organisation_id",
      "user_roles.role",
    ])
    .where("users.email", "!=", "")
    .where(
      "notification_settings.type",
      "=",
      NotificationSettingsType.DAILY_SUMMARY
    )
    .where("notification_settings.enabled", "=", true)
    .execute();

  const allUsersByOrgId = allAdmins
    .filter((u) => u.role != UserRoleType.SUPER_ADMIN) // We don't send to super admins, they get a global update later
    .reduce((acc, user) => {
      const orgId = user.organisation_id;
      if (!acc[orgId]) {
        acc[orgId] = [];
      }
      acc[orgId].push(user);
      return acc;
    }, {});

  const allOrgIDNameMap = (
    await db.selectFrom("organisations").select(["id", "name"]).execute()
  ).reduce((acc, org) => {
    acc[org.id] = org.name;
    return acc;
  }, {});

  for (const orgId in allUsersByOrgId) {
    try {
      const users = allUsersByOrgId[orgId];
      // Get users for the current orgId

      const allConversationIDs = await db
        .selectFrom("conversations")
        .select(["id"])
        .where("organisation_id", "=", orgId)
        .where("last_message_at", ">", oneDayAgo)
        .where("status", "!=", ConversationStatusType.DRAFT)
        .orderBy("last_message_at", "desc")
        .execute();

      const fullConversations = (
        await Promise.all(
          allConversationIDs.map((c) => {
            return getFullConversation(c.id);
          })
        )
      ).filter((c) => c.messages?.length > 0);

      if (fullConversations.length > 0) {
        context.log(
          `Sending Daily Message Summaries - sending orgId: ${orgId}`
        );
        await sendDailySummary(
          allOrgIDNameMap[orgId],
          fullConversations,
          users,
          context
        );
        context.log(`Sending Daily Message Summaries - sent orgId: ${orgId}`);
      }
    } catch (e) {
      context.error(
        `Sending Daily Message Summaries - Error sending daily summary to org ${orgId}} - ${e}`
      );
    }
  }

  // Now sending a summary to all super admins
  try {
    const superAdmins = allAdmins.filter((u) => u.role === "SUPER_ADMIN");
    const allMessagesData = await db
      .selectFrom("conversations")
      .innerJoin("contacts", "conversations.contact_id", "contacts.id")
      .where("last_message_at", ">", oneDayAgo)
      .where("status", "!=", ConversationStatusType.DRAFT)
      .select([
        "conversations.id",
        "contacts.name",
        "contacts.email",
        "contacts.phone",
        "conversations.created_at",
        "conversations.organisation_id",
        "conversations.last_message_at",
        "conversations.status",
        "conversations.summary",
        "conversations.sentiment",
        "conversations.channel",
        "conversations.resolution_estimation",
        "conversations.last_summarisation_at",
      ])
      .orderBy("last_message_at", "desc")
      .execute();

    const allMessages: ConversationsResponse[] = allMessagesData.map((d) => {
      return {
        id: d.id,
        organisation_id: d.organisation_id,
        contact_name: d.name,
        has_contact_details: d.email || d.phone ? true : false,
        created_at: d.created_at,
        last_message_at: d.last_message_at,
        status: d.status,
        summary: d.summary,
        sentiment: d.sentiment,
        channel: d.channel,
        resolution_estimation: d.resolution_estimation,
        last_summarisation_at: d.last_summarisation_at,
      };
    });

    const organisations = await db
      .selectFrom("organisations")
      .select(["id", "name"])
      .execute();

    await sendDailySummaryToSuperAdmins(
      allMessages,
      superAdmins,
      organisations,
      context
    );
  } catch (e) {
    context.error(
      `Sending Daily Message Summaries - Error sending daily summary to super admins - ${e}`
    );
  }
}

app.timer("cronDailyMessageSummaries", {
  schedule: "0 0 5 * * *", // Every day at 5am UTC
  runOnStartup: false,
  handler: cronDailyMessageSummaries,
});
