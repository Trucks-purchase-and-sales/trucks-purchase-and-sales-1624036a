export type SupabaseAuthConfig = Record<string, unknown>;

export type AuthAuditCheck = {
  id: string;
  level: "blocking" | "advisory";
  expected: string;
  observed: unknown;
  pass: boolean | null;
};

export type AuthAuditReport = {
  generated_at: string;
  checks: AuthAuditCheck[];
  sanitized_config: Record<string, unknown>;
  blocking_failures: string[];
};

const SAFE_REPORT_FIELDS = [
  "site_url",
  "uri_allow_list",
  "disable_signup",
  "external_email_enabled",
  "external_phone_enabled",
  "external_anonymous_users_enabled",
  "mailer_autoconfirm",
  "mailer_allow_unverified_email_sign_ins",
  "mailer_secure_email_change_enabled",
  "jwt_exp",
  "refresh_token_rotation_enabled",
  "security_refresh_token_reuse_interval",
  "security_update_password_require_reauthentication",
  "security_manual_linking_enabled",
  "security_captcha_enabled",
  "security_captcha_provider",
  "password_min_length",
  "password_required_characters",
  "password_hibp_enabled",
  "sessions_timebox",
  "sessions_inactivity_timeout",
  "sessions_single_per_user",
  "rate_limit_anonymous_users",
  "rate_limit_email_sent",
  "rate_limit_sms_sent",
  "rate_limit_verify",
  "rate_limit_token_refresh",
  "rate_limit_otp",
  "mfa_max_enrolled_factors",
  "mfa_totp_enroll_enabled",
  "mfa_totp_verify_enabled",
  "mfa_phone_enroll_enabled",
  "mfa_phone_verify_enabled",
] as const;

function boolCheck(
  id: string,
  expectedValue: boolean,
  config: SupabaseAuthConfig,
  level: AuthAuditCheck["level"] = "blocking",
): AuthAuditCheck {
  const observed = config[id];
  return {
    id,
    level,
    expected: String(expectedValue),
    observed,
    pass: typeof observed === "boolean" ? observed === expectedValue : false,
  };
}

function advisoryBool(id: string, expectedValue: boolean, config: SupabaseAuthConfig): AuthAuditCheck {
  const observed = config[id];
  return {
    id,
    level: "advisory",
    expected: String(expectedValue),
    observed,
    pass: typeof observed === "boolean" ? observed === expectedValue : null,
  };
}

export function auditSupabaseAuthConfig(
  config: SupabaseAuthConfig,
  now = new Date(),
): AuthAuditReport {
  const passwordMin = config.password_min_length;
  const checks: AuthAuditCheck[] = [
    {
      id: "password_min_length",
      level: "blocking",
      expected: ">= 15",
      observed: passwordMin,
      pass: typeof passwordMin === "number" && passwordMin >= 15,
    },
    boolCheck("mailer_autoconfirm", false, config),
    boolCheck("mailer_allow_unverified_email_sign_ins", false, config),
    boolCheck("refresh_token_rotation_enabled", true, config),
    boolCheck("security_update_password_require_reauthentication", true, config),
    boolCheck("security_captcha_enabled", true, config),
    boolCheck("security_manual_linking_enabled", false, config),
    boolCheck("external_anonymous_users_enabled", false, config),
    advisoryBool("password_hibp_enabled", true, config),
    advisoryBool("mailer_secure_email_change_enabled", true, config),
    advisoryBool("mfa_totp_enroll_enabled", true, config),
    advisoryBool("mfa_totp_verify_enabled", true, config),
  ];

  const sanitized: Record<string, unknown> = {};
  for (const field of SAFE_REPORT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(config, field)) sanitized[field] = config[field];
  }

  const blockingFailures = checks
    .filter((check) => check.level === "blocking" && check.pass !== true)
    .map((check) => check.id);

  return {
    generated_at: now.toISOString(),
    checks,
    sanitized_config: sanitized,
    blocking_failures: blockingFailures,
  };
}
