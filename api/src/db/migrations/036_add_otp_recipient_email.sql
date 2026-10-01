-- Bind a signup OTP to the email address that received it. This lets account
-- creation persist the verified email before the profile-completion request.

ALTER TABLE auth_otps
  ADD COLUMN recipient_email VARCHAR(255) NULL AFTER channel;
