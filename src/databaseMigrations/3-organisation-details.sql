ALTER TABLE organisations
ADD COLUMN description VARCHAR(2048);

ALTER TABLE organisations
ADD COLUMN website VARCHAR(512);

ALTER TABLE organisations
ADD COLUMN logo_url VARCHAR(512);