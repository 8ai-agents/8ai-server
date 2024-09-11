CREATE TABLE notification_settings (
    user_id VARCHAR(128) NOT NULL,
    type VARCHAR(64) NOT NULL CHECK (type IN ('DAILY_SUMMARY', 'NEGATIVE_SENTIMENT', 'CONTACT_DETAILS_LEFT', 'NEW_CONVERSATION')),
    enabled BOOLEAN NOT NULL,

    PRIMARY KEY (user_id, type),
    CONSTRAINT fk_user
        FOREIGN KEY (user_id) 
        REFERENCES users (id)
        ON DELETE CASCADE
);

INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'DAILY_SUMMARY', true FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'NEGATIVE_SENTIMENT', true FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'CONTACT_DETAILS_LEFT', true FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'NEW_CONVERSATION', false FROM users;
