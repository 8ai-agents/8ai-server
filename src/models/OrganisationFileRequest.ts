export interface OrganisationFileRequest {
  id: string | undefined;
  organisation_id: string;
  original_filename: string;
  name: string;
  url: string;
  content: string;
}
