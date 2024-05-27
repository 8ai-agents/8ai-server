import { InvocationContext } from "@azure/functions";
import { User } from "./models/Database";
import * as OneSignal from "@onesignal/node-onesignal";
import { ConversationResponse } from "./models/ConversationResponse";

export const sendDailySummary = async (
  conversations: ConversationResponse[],
  users: User[],
  context: InvocationContext
) => {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_API_KEY,
  });
  const client = new OneSignal.DefaultApi(configuration);

  for (const user of users.filter((user) => user.email)) {
    const email = new OneSignal.Notification();
    email.app_id = "2962b8af-f3e3-4462-989e-bc983ebaf07a";
    email.include_email_tokens = [user.email];
    email.target_channel = "email";
    email.email_subject = "8ai Daily Conversations Summary";
    email.template_id = "6be607d6-5963-40ef-af7f-134557e49bfd"; //8ai Daily Conversation Summary
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
