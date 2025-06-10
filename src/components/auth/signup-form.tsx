
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase"; // Import db
import { doc, setDoc, Timestamp } from "firebase/firestore"; // Import Firestore functions

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { UserRole } from "@/types";
import { Loader2 } from "lucide-react";


const signupFormSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: "Please select a role."})}),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

export function SignupForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: UserRole.STUDENT, 
    },
  });

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: data.fullName,
        });

        const userRef = doc(db, "users", userCredential.user.uid);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          fullName: data.fullName,
          email: data.email,
          role: data.role,
          createdAt: Timestamp.now(),
          avatarUrl: userCredential.user.photoURL || "",
          canDrive: false, 
        });
      }

      toast({
        title: "Account Created!",
        description: "You have been successfully signed up.",
      });
      setIsLoading(false); // Set loading to false before navigation
      router.push("/dashboard"); 
    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email address is already in use.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "The password is too weak. It must be at least 8 characters long.";
      }
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setIsLoading(false); // Also ensure loading is false in catch block
    }
    // No finally block needed if setIsLoading(false) is handled in both try and catch.
    // If you prefer a finally block, ensure it doesn't interfere with the logic above.
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>I am a...</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your primary role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={UserRole.STUDENT}>Student</SelectItem>
                  <SelectItem value={UserRole.PARENT}>Parent or Guardian</SelectItem>
                  <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Create Account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </Form>
  );
}
