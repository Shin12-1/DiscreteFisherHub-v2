const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const NICKNAME_PATTERN = /^[A-Za-z0-9 _.-]{3,32}$/;

export function validateNickname(value) {
  return NICKNAME_PATTERN.test(String(value || '').trim())
    ? ''
    : 'Use a 3–32 character nickname with letters, numbers, spaces, dots, hyphens, or underscores.';
}

export function validateAuthFields(fields, mode) {
  if (!fields || typeof fields !== 'object') {
    throw new TypeError('Authentication fields must be an object.');
  }
  if (mode !== 'login' && mode !== 'signup') {
    throw new TypeError('Authentication mode must be login or signup.');
  }

  const errors = {};
  const email = String(fields.email || '').trim();
  const password = String(fields.password || '');

  if (!EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (password.length < 8) {
    errors.password = 'Use a password with at least 8 characters.';
  }
  if (mode === 'signup') {
    const nicknameError = validateNickname(fields.nickname);
    if (nicknameError) errors.nickname = nicknameError;
  }

  return errors;
}

export function validatePasswordResetEmail(value) {
  return EMAIL_PATTERN.test(String(value || '').trim())
    ? ''
    : 'Enter a valid email address.';
}

export function validateNewPasswordFields(fields) {
  if (!fields || typeof fields !== 'object') {
    throw new TypeError('Password fields must be an object.');
  }

  const password = String(fields.password || '');
  const confirmPassword = String(fields.confirmPassword || '');
  const errors = {};

  if (password.length < 8) errors.password = 'Use a password with at least 8 characters.';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';

  return errors;
}

export function validateOtpField(value) {
  return String(value || '').trim()
    ? ''
    : 'Enter the verification code.';
}
