import { FeedbackRatingType } from "./Database";

export interface ConversationFeedbackRequest {
  feedback_rating: FeedbackRatingType;
  feedback_suggestion: string;
}
