export interface ContactMetadataResponse {
  contact_id: string;
  browser: string | undefined;
  ip: string | undefined;
  origin: string | undefined;
  location_estimate_string: string | undefined;
  location_estimate_lat: string | undefined;
  location_estimate_lon: string | undefined;
  language: string | undefined;
  language_raw: string | undefined;
}
