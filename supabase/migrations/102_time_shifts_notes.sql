-- Migration 102: add notes column to time_shifts for clock-out annotations
ALTER TABLE public.time_shifts ADD COLUMN IF NOT EXISTS notes text;
