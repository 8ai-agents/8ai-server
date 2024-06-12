CREATE TABLE organisation_slack (
  id VARCHAR(128) PRIMARY KEY,
  organisation_id VARCHAR(128) NOT NULL,
  workspace_id VARCHAR(255) NOT NULL,
  bot_token VARCHAR(511) NOT NULL,
  signing_secret VARCHAR(511) NOT NULL,

  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);