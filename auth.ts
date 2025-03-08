import { cache } from "react";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { z } from "zod";

import { db } from "./lib/db";
import { users } from "./lib/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      emailVerified?: Date | null;
      role?: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate credentials
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);

        if (!parsedCredentials.success) {
          return null;
        }

        const { email, password } = parsedCredentials.data;

        // Find user by email
        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .then((res) => res[0]);

        if (!user) {
          return null;
        }

        // Check if user has a password (they might not if they signed up with OAuth)
        if (!user.password) {
          console.log("User has no password set");
          return null;
        }

        // In a real application, you would use bcrypt to compare the hashed password
        // const isValidPassword = await bcrypt.compare(password, user.password);

        // For this template, we're doing a simple comparison
        // WARNING: This is NOT secure for production - use proper password hashing
        const isValidPassword = password === user.password;

        if (!isValidPassword) {
          console.log("Invalid password");
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    signOut: "/login",
  },
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
    },
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.id || !user.email) {
        return false;
      }

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .then((res) => res[0]);

      if (!existingUser) {
        console.log("No existing user found.");
        return false;
      }

      if (!existingUser.emailVerified) {
        // Implement email verification logic here if needed
        return true; // For now, allow unverified emails
      }

      return true;
    },
    async session({ token, session }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }
        if (token.email) {
          session.user.email = token.email;
        }
        if (token.name) {
          session.user.name = token.name;
        }
        session.user.emailVerified = token.emailVerified as Date | null;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
    async jwt({ token }) {
      if (!token.sub) return token;

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.id, token.sub))
        .then((res) => res[0]);

      if (!existingUser) return token;

      token.name = existingUser.name;
      token.email = existingUser.email;
      token.emailVerified = existingUser.emailVerified;
      token.role = existingUser.role;

      return token;
    },
  },
});

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return session.user;
});
