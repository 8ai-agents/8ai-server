CREATE TABLE organisation_emails (
  id VARCHAR(128) PRIMARY KEY,
  organisation_id VARCHAR(128) NOT NULL,
  username VARCHAR(256) NOT NULL,
  password VARCHAR(256) NOT NULL,
  host VARCHAR(256) NOT NULL,
  port INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_updated BIGINT NOT NULL,

  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);

CREATE INDEX idx_organisation_id ON organisation_emails(organisation_id);