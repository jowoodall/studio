
'use server';

interface VerificationResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  'error-codes'?: string[];
}

/**
 * Verifies a reCAPTCHA v3 token with Google's servers.
 * @param token The reCAPTCHA token generated on the client-side.
 * @returns An object indicating success and the user's score.
 */
export async function verifyRecaptcha(
  token: string
): Promise<{ success: boolean; score: number }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error("[reCAPTCHA Action] Secret key is not set in environment variables.");
    return { success: false, score: 0 };
  }

  const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';

  try {
    const response = await fetch(verificationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    if (!response.ok) {
      console.error(`[reCAPTCHA Action] Verification request failed with status: ${response.status}`);
      return { success: false, score: 0 };
    }

    const data: VerificationResponse = await response.json();

    console.log('[reCAPTCHA Action] Verification response from Google:', data);

    // reCAPTCHA v3 recommends a score threshold of 0.5
    if (data.success && data.score >= 0.5) {
      return { success: true, score: data.score };
    } else {
      return { success: false, score: data.score };
    }
  } catch (error) {
    console.error("[reCAPTCHA Action] Error during verification fetch:", error);
    return { success: false, score: 0 };
  }
}
