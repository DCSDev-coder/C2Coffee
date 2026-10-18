import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_COMPLETE_SETUP_PATH,
  ADMIN_LOGIN_PATH,
  ADMIN_REFRESH_PATH,
  getSafeAdminLoginErrorMessage,
  shouldAttachStoredAdminAccessToken,
  shouldAttemptAdminSessionRefresh,
} from "../src/lib/adminAuthRequestPolicy.js";

test("authentication entry requests never consume the normal refresh flow", () => {
  for (const path of [
    ADMIN_LOGIN_PATH,
    ADMIN_REFRESH_PATH,
    ADMIN_COMPLETE_SETUP_PATH,
  ]) {
    assert.equal(
      shouldAttemptAdminSessionRefresh({
        path,
        status: 401,
        retryOnUnauthorized: true,
      }),
      false,
    );
  }
});

test("protected requests retry once after an unauthorized response", () => {
  assert.equal(
    shouldAttemptAdminSessionRefresh({
      path: "/v1/admin/orders",
      status: 401,
      retryOnUnauthorized: true,
    }),
    true,
  );
  assert.equal(
    shouldAttemptAdminSessionRefresh({
      path: "/v1/admin/orders",
      status: 401,
      retryOnUnauthorized: false,
    }),
    false,
  );
  assert.equal(
    shouldAttemptAdminSessionRefresh({
      path: "/v1/admin/orders",
      status: 403,
      retryOnUnauthorized: true,
    }),
    false,
  );
});

test("stored access tokens are not attached to login or refresh requests", () => {
  assert.equal(shouldAttachStoredAdminAccessToken(ADMIN_LOGIN_PATH), false);
  assert.equal(shouldAttachStoredAdminAccessToken(ADMIN_REFRESH_PATH), false);
  assert.equal(
    shouldAttachStoredAdminAccessToken(ADMIN_COMPLETE_SETUP_PATH),
    true,
  );
  assert.equal(shouldAttachStoredAdminAccessToken("/v1/admin/orders"), true);
});

test("login errors never expose backend validation or account details", () => {
  const unsafeFailures = [
    { code: "validation_error", status: 400, message: "String must contain at least 8 character(s)" },
    { code: "invalid_admin_credentials", status: 401, message: "User does not exist" },
    { code: "admin_not_active", status: 403, message: "Admin account is not active" },
  ];

  for (const failure of unsafeFailures) {
    assert.equal(
      getSafeAdminLoginErrorMessage(failure),
      "The admin username or password is incorrect.",
    );
  }
});

test("login keeps safe operational guidance for throttling and outages", () => {
  assert.equal(
    getSafeAdminLoginErrorMessage({ code: "rate_limit_exceeded", status: 429 }),
    "Too many sign-in attempts. Please wait a few minutes before trying again.",
  );
  assert.equal(
    getSafeAdminLoginErrorMessage({ code: "network_error", status: 503 }),
    "Unable to reach the admin service. Please try again.",
  );
});
