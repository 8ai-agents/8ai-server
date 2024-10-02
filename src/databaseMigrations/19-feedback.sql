ALTER TABLE conversations ADD COLUMN feedback_rating VARCHAR(20) DEFAULT 'UNKNOWN' CHECK (feedback_rating IN ('INCORRECT', 'NOT_HELPFUL', 'UNKNOWN', 'HELPFUL', 'VERY_HELPFUL'));
ALTER TABLE conversations ADD COLUMN feedback_suggestion TEXT;
ALTER TABLE conversations ADD COLUMN feedback_created_at BIGINT;
ALTER TABLE conversations ADD COLUMN feedback_user_id VARCHAR(128);

ALTER TABLE conversations ADD CONSTRAINT fk_feedback_user FOREIGN KEY (feedback_user_id) REFERENCES users(id) ON DELETE SET NULL;
