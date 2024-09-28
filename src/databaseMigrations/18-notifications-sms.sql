ALTER TABLE notification_settings DROP CONSTRAINT notification_settings_type_check;
ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_type_check CHECK (type IN (
    'DAILY_SUMMARY',
    'WEEKLY_SUMMARY',
    'NEGATIVE_SENTIMENT',
    'NEGATIVE_SENTIMENT_SMS',
    'NEGATIVE_SENTIMENT_WHATSAPP',
    'CONTACT_DETAILS_LEFT',
    'CONTACT_DETAILS_LEFT_SMS',
    'CONTACT_DETAILS_LEFT_WHATSAPP',
    'NEW_CONVERSATION',
    'NEW_CONVERSATION_SMS',
    'NEW_CONVERSATION_WHATSAPP'));


INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'NEGATIVE_SENTIMENT_SMS', false FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'NEGATIVE_SENTIMENT_WHATSAPP', false FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'CONTACT_DETAILS_LEFT_SMS', false FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'CONTACT_DETAILS_LEFT_WHATSAPP', false FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'NEW_CONVERSATION_SMS', false FROM users;
INSERT INTO notification_settings (user_id, type, enabled) SELECT id, 'NEW_CONVERSATION_WHATSAPP', false FROM users;
