-- Chay 1 lan trong Supabase SQL Editor cho database da duoc tao truoc do.
-- Them truong phong vao ca phong van; du lieu cu mac dinh de trong.
ALTER TABLE public.slots
ADD COLUMN IF NOT EXISTS room text NOT NULL DEFAULT '';
