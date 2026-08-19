CREATE TRIGGER create_reader_profile
AFTER INSERT ON "user"
BEGIN
  INSERT INTO profiles (
    user_id,
    display_name,
    role
  )
  VALUES (
    NEW.id,
    NEW.name,
    'reader'
  );
END;
