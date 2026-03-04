-- Trigger: quando un utente si registra, crea automaticamente tenant + profile
-- Eseguire su Supabase SQL Editor DOPO lo schema.sql

-- Funzione che crea tenant e profile alla registrazione
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_tenant_id UUID;
BEGIN
  -- Crea un nuovo tenant per l'utente
  INSERT INTO tenants (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    REPLACE(LOWER(COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))), ' ', '-') || '-' || SUBSTRING(NEW.id::TEXT, 1, 8)
  )
  RETURNING id INTO new_tenant_id;

  -- Crea il profilo collegato
  INSERT INTO profiles (id, tenant_id, full_name, role)
  VALUES (
    NEW.id,
    new_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'admin'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Collega il trigger alla tabella auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Crea tenant + profile per utenti GIA' registrati che non hanno ancora un profile
DO $$
DECLARE
  usr RECORD;
  new_tenant_id UUID;
BEGIN
  FOR usr IN
    SELECT * FROM auth.users
    WHERE id NOT IN (SELECT id FROM profiles)
  LOOP
    INSERT INTO tenants (name, slug)
    VALUES (
      COALESCE(usr.raw_user_meta_data->>'full_name', usr.email),
      REPLACE(LOWER(COALESCE(usr.raw_user_meta_data->>'full_name', SPLIT_PART(usr.email, '@', 1))), ' ', '-') || '-' || SUBSTRING(usr.id::TEXT, 1, 8)
    )
    RETURNING id INTO new_tenant_id;

    INSERT INTO profiles (id, tenant_id, full_name, role)
    VALUES (
      usr.id,
      new_tenant_id,
      COALESCE(usr.raw_user_meta_data->>'full_name', usr.email),
      'admin'
    );
  END LOOP;
END;
$$;
