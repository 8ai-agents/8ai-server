CREATE TABLE user_roles (
    organisation_id VARCHAR(128) NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    role VARCHAR(128) NOT NULL CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    active BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (organisation_id, user_id),
    CONSTRAINT fk_user
        FOREIGN KEY (user_id) 
        REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_organisation
        FOREIGN KEY (organisation_id) 
        REFERENCES organisations (id)
        ON DELETE CASCADE
);

INSERT INTO public.user_roles(organisation_id, user_id, role, active) SELECT organisation_id, id, role, true FROM users;

ALTER TABLE public.users DROP CONSTRAINT users_role_check;
ALTER TABLE public.users DROP COLUMN role;

ALTER TABLE public.users DROP CONSTRAINT users_organisation_id_fkey;
ALTER TABLE public.users DROP COLUMN organisation_id;
