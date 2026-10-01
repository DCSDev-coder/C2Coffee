-- A shift remains assigned to the date it starts. An earlier end time means it
-- finishes after midnight, so only identical start and end times are invalid.

ALTER TABLE barista_weekly_schedules
  DROP CHECK chk_barista_weekly_schedule_time,
  ADD CONSTRAINT chk_barista_weekly_schedule_time CHECK (ends_at <> starts_at);

ALTER TABLE barista_dated_shifts
  DROP CHECK chk_barista_dated_shift_time,
  ADD CONSTRAINT chk_barista_dated_shift_time CHECK (ends_at <> starts_at);
