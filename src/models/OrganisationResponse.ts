export interface OrganisationResponse {
  id: string;
  name: string;
  assistant_id: string | undefined;
  description: string;
  website: string;
  logo_url: string;
  support_email: string;
  support_phone: string;
  chat_icon_color: string;
  chat_bubble_color: string;
  chat_text_color: string;
  fine_tuning_filename: string;
  default_questions: string[];
}
