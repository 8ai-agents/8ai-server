ALTER TABLE organisations
ADD COLUMN support_email VARCHAR(256);

ALTER TABLE organisations
ADD COLUMN support_phone VARCHAR(256);

ALTER TABLE organisations
ADD COLUMN chat_icon_color VARCHAR(32);

ALTER TABLE organisations
ADD COLUMN chat_bubble_color VARCHAR(32);

ALTER TABLE organisations
ADD COLUMN chat_text_color VARCHAR(32);