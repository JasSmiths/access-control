PRAGMA foreign_keys = ON;

ALTER TABLE admin_users
  ADD COLUMN vehicle_group_order TEXT;
