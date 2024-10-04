import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationFeedbackRequest } from "../models/ConversationFeedbackRequest";
import { authenticateRequest } from "../AuthController";
import { db, getFullConversation, getUser } from "../DatabaseController";
import { checkUserIsAdmin } from "../Utils";
import { ConversationFeedbackResponse } from "../models/ConversationFeedbackResponse";
import { sendConversationFeedbackAlert } from "../OneSignalHandler";

export async function updateConversationFeedback(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const conv_id = request.params.conv_id as string;
  if (!conv_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }

  const feedbackRequest = (await request.json()) as ConversationFeedbackRequest;

  const { organisation_id } = await db
    .selectFrom("conversations")
    .select(["organisation_id"])
    .executeTakeFirst();

  let email;
  try {
    email = await authenticateRequest(request);
    if (!checkUserIsAdmin(organisation_id, email, false))
      return { status: 403 };
  } catch {
    return { status: 401 };
  }

  try {
    context.log(`Processing feedback for conversation ${conv_id}`);

    const user = await getUser(email);

    const result: ConversationFeedbackResponse = {
      ...(await db
        .updateTable("conversations")
        .set({
          feedback_suggestion: feedbackRequest.feedback_suggestion,
          feedback_rating: feedbackRequest.feedback_rating,
          feedback_user_id: user.id,
          feedback_created_at: Date.now(),
        })
        .where("id", "=", conv_id)
        .returning([
          "feedback_suggestion",
          "feedback_rating",
          "feedback_user_id",
          "feedback_created_at",
        ])
        .executeTakeFirst()),
      feedback_user_name: user.name,
    };

    // Notify admin users
    const fullConversations = await getFullConversation(conv_id);
    await sendConversationFeedbackAlert(result, fullConversations, context);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error(`Error updating conversation feedback: ${error}`);

    return {
      status: 500,
      jsonBody: {
        error: "Failed to update conversation feedback",
      },
    };
  }
}

app.http("updateConversationFeedback", {
  methods: ["PUT"],
  route: "conversations/{conv_id}/feedback",
  authLevel: "anonymous",
  handler: updateConversationFeedback,
});
