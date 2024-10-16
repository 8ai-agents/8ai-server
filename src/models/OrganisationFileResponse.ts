export interface OrganisationFileResponse {
  id: string;
  organisation_id: string;
  name: string;
  url: string;
  content: string;
  created_at: number;
  updated_at: number;
  training_status: OrganisationFileTrainingStatuses;
}

export enum OrganisationFileTrainingStatuses {
  NOT_SYNCED = "NOT_SYNCED",
  IN_PROGRESS = "IN_PROGRESS",
  ACTIVE = "ACTIVE",
  ERROR = "ERROR",
}
