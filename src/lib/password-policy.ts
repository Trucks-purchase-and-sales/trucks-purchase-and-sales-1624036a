export const NEW_PASSWORD_MIN_LENGTH = 15;

export type NewPasswordValidation =
  | { valid: true }
  | { valid: false; message: string };

/**
 * Wilmet application-side rule for passwords being created or changed.
 *
 * This is a UX/application guard, not the authoritative security boundary:
 * the hosted Supabase Auth verifier must be configured to enforce the same
 * minimum independently so direct Auth API calls cannot bypass Wilmet UI.
 *
 * We intentionally do not require arbitrary character classes here. Password
 * length is the deterministic application rule; compromised/common-password
 * screening belongs at the identity provider where it cannot be bypassed.
 */
export function validateNewPassword(password: string): NewPasswordValidation {
  if (password.length < NEW_PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Le mot de passe doit contenir au moins ${NEW_PASSWORD_MIN_LENGTH} caractères.`,
    };
  }

  return { valid: true };
}

export const NEW_PASSWORD_HELP =
  `${NEW_PASSWORD_MIN_LENGTH} caractères minimum. Utilisez une phrase de passe longue et unique.`;
