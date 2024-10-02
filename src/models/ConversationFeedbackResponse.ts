import { FeedbackRatingType } from "./Database";

export interface ConversationFeedbackResponse {
  feedback_rating: FeedbackRatingType;
  feedback_suggestion: string;
  feedback_created_at: number;
  feedback_user_id: string;
  feedback_user_name: string;
}
