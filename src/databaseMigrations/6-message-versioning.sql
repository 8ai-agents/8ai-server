ALTER TABLE messages ADD COLUMN version INT;

UPDATE messages SET version = 1;

ALTER TABLE messages ALTER COLUMN version SET NOT NULL;