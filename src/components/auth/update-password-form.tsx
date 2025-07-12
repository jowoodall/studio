
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import React, { useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/\d/, "Password must contain at least one number.");

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match.",
  path: ["confirmPassword"],
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

function PasswordStrength({ password = "" }) {
  const checks = [
    { requirement: "At least 8 characters long", fulfilled: password.length >= 8 },
    { requirement: "Contains a lowercase letter (a-z)", fulfilled: /[a-z]/.test(password) },
    { requirement: "Contains an uppercase letter (A-Z)", fulfilled: /[A-Z]/.test(password) },
    { requirement: "Contains a number (0-9)", fulfilled: /\d/.test(password) },
  ];

  return (
    <ul className="space-y-1 text-xs text-muted-foreground mt-2">
      {checks.map((check, index) => (
        <li key={index} className="flex items-center gap-2">
          {check.fulfilled ? <Check className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-destructive" />}
          <span>{check.requirement}</span>
        </li>
      ))}
    </ul>
  );
}

export function UpdatePasswordForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    mode: "onBlur",
  });

  const newPasswordValue = form.watch("newPassword");

  async function onSubmit(data: UpdatePasswordFormValues) {
    if (!user || !user.email) {
      toast({ title: "Error", description: "Not logged in or user email is unavailable.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      await updatePassword(user, data.newPassword);
      
      toast({
        title: "Password Updated",
        description: "Your password has been successfully changed.",
      });
      form.reset();

    } catch (error: any) {
      console.error("Password update error:", error);
      let errorMessage = "An unexpected error occurred.";
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "The current password you entered is incorrect.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The new password is too weak. Please ensure it meets all requirements.";
      }
      toast({
        title: "Update Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Password Management</CardTitle>
        <CardDescription>
          Change your account password here. You will need to provide your current password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                  <PasswordStrength password={newPasswordValue} />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Update Password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
