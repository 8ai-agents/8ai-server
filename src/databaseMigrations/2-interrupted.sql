ALTER TABLE conversations
ADD COLUMN assignee_id VARCHAR(128),
ADD CONSTRAINT fk_conversations_assignee_id
    FOREIGN KEY (assignee_id) 
    REFERENCES users(id);

ALTER TABLE conversations
ADD COLUMN interrupted BOOLEAN;

ALTER TABLE organisations
ADD COLUMN assistant_id VARCHAR(512);
