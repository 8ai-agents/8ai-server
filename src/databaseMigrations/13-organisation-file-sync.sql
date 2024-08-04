ALTER TABLE organisation_files ADD COLUMN openai_id VARCHAR(512);
ALTER TABLE organisation_files ADD COLUMN refresh_frequency VARCHAR(10) DEFAULT 'WEEKLY' CHECK (refresh_frequency IN ('DAILY', 'WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'NEVER'));
ALTER TABLE organisation_files ADD COLUMN last_refreshed BIGINT;


UPDATE organisation_files SET openai_id = id;
