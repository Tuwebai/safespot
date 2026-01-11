import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Verifies a Google Token (ID Token OR Access Token) and returns user payload.
 * @param {object} params - { google_id_token, google_access_token }
 * @returns {Promise<{sub: string, email: string, email_verified: boolean, name: string, picture: string}>}
 */
async function verifyGoogleToken({ google_id_token, google_access_token }) {

    // CASE A: Access Token (from Custom Frontends)
    if (google_access_token) {
        try {
            // Fetch UserInfo from Google
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${google_access_token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch user info');

            const profile = await res.json();
            return {
                sub: profile.sub,
                email: profile.email,
                email_verified: profile.email_verified,
                name: profile.name,
                picture: profile.picture
            };
        } catch (e) {
            console.error('Google Access Token verification failed:', e.message);
            throw new Error('Invalid Google Access Token');
        }
    }

    // CASE B: ID Token (Legacy/Official Button)
    if (google_id_token) {
        try {
            const ticket = await client.verifyIdToken({
                idToken: google_id_token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            return {
                sub: payload.sub,
                email: payload.email,
                email_verified: payload.email_verified,
                name: payload.name,
                picture: payload.picture
            };
        } catch (error) {
            console.error('Google ID Token verification failed:', error.message);
            throw new Error('Invalid Google ID Token');
        }
    }

    throw new Error('Token is required');
}

// Export as named export for consistency
export { verifyGoogleToken };
