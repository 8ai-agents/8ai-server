ALTER TABLE organisation_files ADD COLUMN openai_id VARCHAR(512);
ALTER TABLE organisation_files ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0;
ALTER TABLE organisation_files ADD COLUMN updated_at BIGINT NOT NULL DEFAULT 0;

UPDATE organisation_files SET openai_id = id;
