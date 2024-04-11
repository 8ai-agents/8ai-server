-- Create the contacts table
CREATE TABLE contacts (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(512) NOT NULL,
  email VARCHAR(512),
  phone VARCHAR(256)
);

-- Create the conversations table
CREATE TABLE conversations (
  id VARCHAR(128) PRIMARY KEY,
  contact_id VARCHAR(128) NOT NULL,
  created_at BIGINT NOT NULL,
  last_message_at BIGINT NOT NULL,
  status VARCHAR(10) CHECK (status IN ('DRAFT', 'OPEN', 'CLOSED')),
  summary TEXT,
  sentiment INT,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX idx_conversation_status ON conversations(status);
CREATE INDEX idx_conversation_last_message_at ON conversations(last_message_at);

-- Create the messages table
CREATE TABLE messages (
  id VARCHAR(128) PRIMARY KEY,
  conversation_id VARCHAR(128) NOT NULL,
  message TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  creator VARCHAR(10) CHECK (creator IN ('AGENT', 'CONTACT')),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
