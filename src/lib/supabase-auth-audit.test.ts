import { describe, expect, test } from "bun:test";
import { auditSupabaseAuthConfig } from "./supabase-auth-audit";

const secureConfig = {
  password_min_length: 15,
  mailer_autoconfirm: false,
  mailer_allow_unverified_email_sign_ins: false,
  refresh_token_rotation_enabled: true,
  security_update_password_require_reauthentication: true,
  security_captcha_enabled: true,
  security_captcha_provider: "turnstile",
  security_manual_linking_enabled: false,
  external_anonymous_users_enabled: false,
  password_hibp_enabled: true,
  mailer_secure_email_change_enabled: true,
  mfa_totp_enroll_enabled: true,
  mfa_totp_verify_enabled: true,
  site_url: "https://wilmet.example",
  smtp_pass: "MUST-NEVER-APPEAR-IN-REPORT",
  security_captcha_secret: "MUST-NEVER-APPEAR-IN-REPORT",
};

describe("Supabase hosted Auth audit", () => {
  test("passes the defined blocking production controls", () => {
    const report = auditSupabaseAuthConfig(secureConfig, new Date("2026-08-19T00:00:00Z"));
    expect(report.blocking_failures).toEqual([]);
    expect(report.generated_at).toBe("2026-08-19T00:00:00.000Z");
  });

  test("fails closed when a blocking field is weak or absent", () => {
    const report = auditSupabaseAuthConfig({
      ...secureConfig,
      password_min_length: 6,
      security_captcha_enabled: false,
      refresh_token_rotation_enabled: undefined,
    });
    expect(report.blocking_failures).toContain("password_min_length");
    expect(report.blocking_failures).toContain("security_captcha_enabled");
    expect(report.blocking_failures).toContain("refresh_token_rotation_enabled");
  });

  test("sanitizes management-api output before retaining evidence", () => {
    const report = auditSupabaseAuthConfig(secureConfig);
    expect(report.sanitized_config.site_url).toBe("https://wilmet.example");
    expect(report.sanitized_config.security_captcha_provider).toBe("turnstile");
    expect("smtp_pass" in report.sanitized_config).toBe(false);
    expect("security_captcha_secret" in report.sanitized_config).toBe(false);
    expect(JSON.stringify(report)).not.toContain("MUST-NEVER-APPEAR-IN-REPORT");
  });

  test("HIBP and MFA capability are advisory rather than false claims of enforcement", () => {
    const report = auditSupabaseAuthConfig({
      ...secureConfig,
      password_hibp_enabled: false,
      mfa_totp_enroll_enabled: false,
      mfa_totp_verify_enabled: false,
    });
    expect(report.blocking_failures).toEqual([]);
    const advisory = report.checks.filter((check) => check.level === "advisory");
    expect(advisory.find((check) => check.id === "password_hibp_enabled")?.pass).toBe(false);
    expect(advisory.find((check) => check.id === "mfa_totp_enroll_enabled")?.pass).toBe(false);
  });
});
