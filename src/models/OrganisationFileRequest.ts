import { RefreshFrequency } from "./Database";

export interface OrganisationFileRequest {
  id: string | undefined;
  openai_id: string;
  organisation_id: string;
  name: string;
  url: string;
  content: string | undefined;
  refresh_frequency: RefreshFrequency;
  last_refreshed: number | undefined;
}
