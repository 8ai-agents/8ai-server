ALTER TABLE organisations ADD COLUMN fine_tuning_filename VARCHAR(512);

CREATE TABLE organisation_files (
  id VARCHAR(512) PRIMARY KEY,
  organisation_id VARCHAR(128) NOT NULL,
  url VARCHAR(512) NOT NULL,
  content text,
  
  FOREIGN KEY (organisation_id) REFERENCES organisations(id)
);