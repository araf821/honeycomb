import { z } from "zod";

export const registerSchema = z
  .object({
    email: z
      .string()
      .email("Please enter a valid email address")
      .trim()
      .toLowerCase(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be less than 100 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      ),
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "Name is too long"),
    confirmPassword: z
      .string()
      .trim()
      .min(8, "Password must be at least 8 characters")
      .max(100, "Password must be less than 100 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters"),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type SignInRequest = z.infer<typeof signInSchema>;
