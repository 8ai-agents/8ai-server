import { app, InvocationContext, Timer } from "@azure/functions";
import { db } from "../DatabaseController";

export async function cronCleanDraftConversations(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  context.log(`Cleaning Draft Conversations`);
  const oneHourAgo: number = Date.now() - 1000 * 60 * 60 * 12; // More than 12 hours ago
  const allConversations = await db
    .selectFrom("conversations")
    .select(["id", "contact_id", "status", "last_message_at"])
    .execute();

  const conversationsToDelete = allConversations.filter(
    (c) => c.status == "DRAFT" && c.last_message_at < oneHourAgo,
  );

  if (conversationsToDelete.length > 0) {
    const contactsToDelete: string[] = [];
    for (const { contact_id } of conversationsToDelete) {
      // Check if we can delete the contact ID
      if (
        conversationsToDelete.filter((c) => c.contact_id == contact_id)
          .length ===
        allConversations.filter((c) => c.contact_id === contact_id).length
      ) {
        contactsToDelete.push(contact_id);
      }
    }

    await db
      .deleteFrom("messages")
      .where(
        "conversation_id",
        "in",
        conversationsToDelete.map((c) => c.id),
      )
      .execute();

    await db
      .deleteFrom("conversations")
      .where(
        "id",
        "in",
        conversationsToDelete.map((c) => c.id),
      )
      .execute();

    await db
      .deleteFrom("contacts")
      .where("id", "in", contactsToDelete)
      .execute();

    context.log(
      `Cleaned Draft Conversations - Deleted ${contactsToDelete.length} conversations and ${contactsToDelete.length} contacts`,
    );
  } else {
    context.log(`Cleaned Draft Conversations - No conversations to delete`);
  }
}

app.timer("cronCleanDraftConversations", {
  schedule: "0 * */12 * * *", // Every 12 hours
  //schedule: "* * * * *", // Every minute for testing
  handler: cronCleanDraftConversations,
});
