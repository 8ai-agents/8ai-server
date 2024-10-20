import { app, InvocationContext, Timer } from "@azure/functions";
import { db, getFullConversation } from "../DatabaseController";
import {
  ConversationStatusType,
  NotificationSettingsType,
} from "../models/Database";
import { sendWeeklySummary } from "../OneSignalHandler";

export async function cronWeeklyMessageSummaries(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log("Sending Weekly Message Summaries");

  const oneWeekAgo: number = Date.now() - 1000 * 60 * 60 * 24 * 7; // More than 7 days ago

  const allAdmins = await db
    .selectFrom("users")
    .leftJoin(
      "notification_settings",
      "users.id",
      "notification_settings.user_id",
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
      NotificationSettingsType.WEEKLY_SUMMARY,
    )
    .where("notification_settings.enabled", "=", true)
    .execute();

  const allUsersByOrgId = allAdmins.reduce((acc, user) => {
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
        .where("last_message_at", ">", oneWeekAgo)
        .where("status", "!=", ConversationStatusType.DRAFT)
        .orderBy("last_message_at", "desc")
        .execute();

      const fullConversations = (
        await Promise.all(
          allConversationIDs.map((c) => {
            return getFullConversation(c.id);
          }),
        )
      ).filter((c) => c.messages?.length > 0);

      if (fullConversations.length > 0) {
        context.log(
          `Sending weekly Message Summaries - sending orgId: ${orgId}`,
        );
        await sendWeeklySummary(
          allOrgIDNameMap[orgId],
          fullConversations,
          users,
          context,
        );
        context.log(`Sending weekly Message Summaries - sent orgId: ${orgId}`);
      }
    } catch (e) {
      context.error(
        `Sending weekly Message Summaries - Error sending weekly summary to org ${orgId}} - ${e}`,
      );
    }
  }
}

app.timer("cronWeeklyMessageSummaries", {
  schedule: "0 0 5 * * Mon", // Every Monday at 5am UTC
  runOnStartup: false,
  handler: cronWeeklyMessageSummaries,
});
