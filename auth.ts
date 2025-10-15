
import NextAuth from "next-auth"


const vercelEnv = process.env.VERCEL_ENV || 'development';
const useSecureCookies = vercelEnv != 'development';
const cookieHostname = vercelEnv == 'development' ? 'localhost' : process.env.AUTH_HOST;
const cookiePrefix = useSecureCookies ? '__Secure-' : '';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [],
  pages: {
    signIn: '/',
    signOut: '/',
  },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
        domain: cookieHostname == 'localhost' ? cookieHostname : '.' + cookieHostname, // add a . in front so that subdomains are included
      },
    },
    // Repeat for other NextAuth.js cookies if needed (e.g., callbackUrl, csrfToken)
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: cookieHostname === "localhost" ? cookieHostname : `.${cookieHostname}`,
      },
    },
    csrfToken: {
      name: `${cookiePrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies, // CSRF token might not always need to be secure in dev
        domain: cookieHostname === "localhost" ? cookieHostname : `.${cookieHostname}`,
      },
    },
  },
  callbacks: {
    authorized: async ({ auth }) => {
      // Logged in users are authenticated, otherwise redirect to login page
      return !!auth
    },
    jwt: async ({ token, user, account }) => {
      if (user) {
        token.id = user.id;
        if (account) {
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token;
          token.expiresAt = account.expires_at;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string;
      return session;
    },
  }
})