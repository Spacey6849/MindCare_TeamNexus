    -- Seed an admin account (username: admin, password: Admin@6849)
    -- Requires pgcrypto (for gen_random_uuid and password hashing)
    -- IMPORTANT: This stores a bcrypt hash, not the raw password

    -- Ensure extension
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    INSERT INTO public.admin_accounts (id, username, email, password_hash, full_name, role)
    VALUES (
    gen_random_uuid(),
    'admin',
    'admin@example.com',
    crypt('Admin@6849', gen_salt('bf')),
    'System Administrator',
    'admin'
    )
    ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    updated_at = NOW();
