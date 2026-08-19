import { describe, expect, test } from "bun:test";
import {
  NEW_PASSWORD_HELP,
  NEW_PASSWORD_MIN_LENGTH,
  validateNewPassword,
} from "./password-policy";

describe("Wilmet new password policy", () => {
  test("requires at least 15 characters for newly created/changed passwords", () => {
    expect(NEW_PASSWORD_MIN_LENGTH).toBe(15);
    expect(validateNewPassword("a".repeat(14))).toEqual({
      valid: false,
      message: "Le mot de passe doit contenir au moins 15 caractères.",
    });
    expect(validateNewPassword("a".repeat(15))).toEqual({ valid: true });
  });

  test("does not impose arbitrary composition rules", () => {
    expect(validateNewPassword("correct horse battery staple")).toEqual({ valid: true });
    expect(validateNewPassword("aaaaaaaaaaaaaaa")).toEqual({ valid: true });
  });

  test("help text communicates the same minimum", () => {
    expect(NEW_PASSWORD_HELP).toContain("15 caractères minimum");
  });
});
