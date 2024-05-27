import { app, InvocationContext, Timer } from "@azure/functions";
import { db, getFullConversation } from "../DatabaseController";
import { ConversationStatusType } from "../models/Database";
import { sendDailySummary } from "../OneSignalHandler";

export async function cronDailyMessageSummaries(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log("Sending Daily Message Summaries");

  const oneDayAgo: number = Date.now() - 1000 * 60 * 60 * 24; // More than 24 hours ago

  const allUsers = await db
    .selectFrom("users")
    .select(["id", "name", "email", "organisation_id"])
    .where("email", "!=", "")
    .execute();

  const allUsersByOrgId = allUsers.reduce((acc, user) => {
    const orgId = user.organisation_id;
    if (!acc[orgId]) {
      acc[orgId] = [];
    }
    acc[orgId].push(user);
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
        await sendDailySummary(fullConversations, users, context);
        context.log(`Sending Daily Message Summaries - sent orgId: ${orgId}`);
      }
    } catch (e) {
      context.error(
        `Sending Daily Message Summaries - Error sending daily summary to org ${orgId}} - ${e}`
      );
    }
  }
}

app.timer("cronDailyMessageSummaries", {
  schedule: "0 0 5 * * *",
  handler: cronDailyMessageSummaries,
});
