import {
  validateEmail,
  validateFullName,
  validatePassword,
} from '@/utils/validation';

import {
  ApiClientError,
  apiRequest,
  loadPersistedSession,
  notifyAuthEvent,
  setPersistedSession,
  type AuthSession,
  type AuthUser,
} from './apiClient';

export interface AuthActionResult {
  ok: boolean;
  message?: string;
  requiresEmailConfirmation?: boolean;
  recoveryCode?: string;
  session?: AuthSession | null;
  user?: AuthUser | null;
}

// Holds an in-memory password-recovery JWT returned by `/api/auth/verify-recovery`
// without elevating it into a persistent signed-in access session until password reset succeeds.
let activeRecoveryToken: string | null = null;

function mapAuthError(err: unknown, fallback: string): string {
  if (err instanceof ApiClientError) {
    return err.message;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}

export async function signInWithEmail(
  rawEmail: string,
  rawPassword: string
): Promise<AuthActionResult> {
  const emailCheck = validateEmail(rawEmail);
  if (!emailCheck.ok || !emailCheck.value) {
    return { ok: false, message: emailCheck.error ?? 'Enter a valid email.' };
  }

  const passwordCheck = validatePassword(rawPassword);
  if (!passwordCheck.ok || !passwordCheck.value) {
    return {
      ok: false,
      message: passwordCheck.error ?? 'Enter your password.',
    };
  }

  try {
    const res = await apiRequest<{
      ok: boolean;
      session: AuthSession;
    }>('/api/auth/login', {
      method: 'POST',
      skipAuth: true,
      body: {
        email: emailCheck.value,
        password: passwordCheck.value,
      },
    });

    activeRecoveryToken = null;
    await setPersistedSession(res.session, 'SIGNED_IN');

    return {
      ok: true,
      session: res.session,
      user: res.session.user,
    };
  } catch (err) {
    return {
      ok: false,
      message: mapAuthError(err, 'Unable to sign in. Please try again.'),
    };
  }
}

export async function signUpWithEmail(params: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const nameCheck = validateFullName(params.fullName);
  if (!nameCheck.ok || !nameCheck.value) {
    return { ok: false, message: nameCheck.error ?? 'Enter your full name.' };
  }

  const emailCheck = validateEmail(params.email);
  if (!emailCheck.ok || !emailCheck.value) {
    return { ok: false, message: emailCheck.error ?? 'Enter a valid email.' };
  }

  const passwordCheck = validatePassword(params.password);
  if (!passwordCheck.ok || !passwordCheck.value) {
    return {
      ok: false,
      message: passwordCheck.error ?? 'Enter a valid password.',
    };
  }

  try {
    const res = await apiRequest<{
      ok: boolean;
      session: AuthSession;
    }>('/api/auth/register', {
      method: 'POST',
      skipAuth: true,
      body: {
        fullName: nameCheck.value,
        email: emailCheck.value,
        password: passwordCheck.value,
      },
    });

    activeRecoveryToken = null;
    await setPersistedSession(res.session, 'SIGNED_IN');

    return {
      ok: true,
      requiresEmailConfirmation: false,
      session: res.session,
      user: res.session.user,
      message: 'Account created and signed in.',
    };
  } catch (err) {
    return {
      ok: false,
      message: mapAuthError(err, 'Unable to create your account.'),
    };
  }
}

export async function signOutSession(): Promise<AuthActionResult> {
  activeRecoveryToken = null;
  try {
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      clearSessionOn401: false,
      timeoutMs: 3000,
    });
  } catch {
    // Always sign out locally even if backend is unreachable
  }

  await setPersistedSession(null, 'SIGNED_OUT');
  return { ok: true };
}

export async function sendPasswordReset(rawEmail: string): Promise<AuthActionResult> {
  const emailCheck = validateEmail(rawEmail);
  if (!emailCheck.ok || !emailCheck.value) {
    return { ok: false, message: emailCheck.error ?? 'Enter a valid email.' };
  }

  try {
    const res = await apiRequest<{
      ok: boolean;
      message?: string;
      recoveryCode?: string;
    }>('/api/auth/forgot-password', {
      method: 'POST',
      skipAuth: true,
      body: { email: emailCheck.value },
    });

    return {
      ok: true,
      recoveryCode: res.recoveryCode,
      message:
        res.message ??
        `Password reset instructions sent to ${emailCheck.value}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: mapAuthError(err, 'Could not start password reset right now.'),
    };
  }
}

export async function exchangeRecoveryCode(code: string): Promise<AuthActionResult> {
  try {
    const res = await apiRequest<{
      ok: boolean;
      session: AuthSession;
    }>('/api/auth/verify-recovery', {
      method: 'POST',
      skipAuth: true,
      body: { code },
    });

    activeRecoveryToken = res.session.accessToken;
    notifyAuthEvent('PASSWORD_RECOVERY', res.session);

    return {
      ok: true,
      session: res.session,
      user: res.session.user,
    };
  } catch (err) {
    return {
      ok: false,
      message: mapAuthError(
        err,
        'This password reset link or code has expired or is invalid. Request a new reset code.'
      ),
    };
  }
}

export async function updateAccountPassword(
  newPassword: string
): Promise<AuthActionResult> {
  const passwordCheck = validatePassword(newPassword);
  if (!passwordCheck.ok || !passwordCheck.value) {
    return {
      ok: false,
      message: passwordCheck.error ?? 'Enter a valid password.',
    };
  }

  try {
    const current = await loadPersistedSession();
    const tokenToUse = activeRecoveryToken ?? current?.accessToken;
    if (!tokenToUse) {
      return {
        ok: false,
        message: 'Verify your recovery code first before choosing a new password.',
      };
    }

    const res = await apiRequest<{
      ok: boolean;
      message?: string;
      session: AuthSession;
    }>('/api/auth/update-password', {
      method: 'POST',
      tokenOverride: tokenToUse,
      body: { newPassword: passwordCheck.value },
    });

    activeRecoveryToken = null;
    await setPersistedSession(res.session, 'USER_UPDATED');

    return {
      ok: true,
      message: res.message ?? 'Your password has been updated.',
      session: res.session,
      user: res.session.user,
    };
  } catch (err) {
    return {
      ok: false,
      message: mapAuthError(err, 'Unable to update password right now.'),
    };
  }
}

export async function verifyStoredSession(): Promise<AuthSession | null> {
  const stored = await loadPersistedSession();
  if (!stored) return null;

  try {
    const res = await apiRequest<{ user: AuthUser }>('/api/auth/me', {
      method: 'GET',
      tokenOverride: stored.accessToken,
      clearSessionOn401: true,
    });

    const refreshedSession: AuthSession = {
      ...stored,
      user: {
        ...stored.user,
        ...res.user,
      },
    };
    return refreshedSession;
  } catch (err) {
    if (err instanceof ApiClientError && err.status === 401) {
      return null;
    }
    // Keep cached session if offline so user can view signed-in error notice / retry
    return stored;
  }
}
