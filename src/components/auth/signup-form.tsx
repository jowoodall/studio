
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import Link from "next/link";
import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp, getDocs, query, where, writeBatch, collection, getDoc, updateDoc } from "firebase/firestore";
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
import { UserRole, SubscriptionTier, UserStatus, type UserProfileData } from "@/types";
import { Loader2, Check, X } from "lucide-react";

import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { verifyRecaptcha } from '@/actions/recaptchaActions';
import { cn } from "@/lib/utils";

const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long.")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
  .regex(/\d/, "Password must contain at least one number.");

const signupFormSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: passwordSchema,
  confirmPassword: z.string(),
  role: z.nativeEnum(UserRole, { errorMap: () => ({ message: "Please select a role."})}),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupFormSchema>;

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


export function SignupForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: UserRole.STUDENT, 
    },
    mode: "onBlur",
  });

  const passwordValue = form.watch("password");

  async function onSubmit(data: SignupFormValues) {
    setIsLoading(true);

    if (!executeRecaptcha) {
      console.error("reCAPTCHA not initialized. Check provider and site key configuration.");
      toast({
        title: "Security Check Unavailable",
        description: "Could not initialize reCAPTCHA. Please ensure the site is configured correctly in the .env file.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const token = await executeRecaptcha('signup');
      const verificationResult = await verifyRecaptcha(token);

      if (!verificationResult.success) {
          toast({
              title: "Security Check Failed",
              description: "Your request could not be verified as human. Please try again.",
              variant: "destructive",
          });
          setIsLoading(false);
          return;
      }
      
      const normalizedEmail = data.email.trim().toLowerCase();

      // Check for an existing placeholder user
      const usersRef = collection(db, "users");
      const placeholderQuery = query(usersRef, where("email", "==", normalizedEmail), where("status", "==", "invited"));
      const placeholderSnapshot = await getDocs(placeholderQuery);
      
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: data.fullName });
      
      if (!placeholderSnapshot.empty) {
        // --- Claim Placeholder Flow ---
        const placeholderDoc = placeholderSnapshot.docs[0];
        console.log(`[Signup] Claiming placeholder account ${placeholderDoc.id} for new user ${user.uid}.`);
        
        // We will move the placeholder doc to a new doc with the correct Auth UID
        const batch = writeBatch(db);
        
        // 1. Get placeholder data
        const placeholderData = placeholderDoc.data() as UserProfileData;
        
        // 2. Create the new user document with the real Auth UID, merging in placeholder data
        const realUserRef = doc(db, "users", user.uid);
        const finalProfileData: UserProfileData = {
          ...placeholderData,
          uid: user.uid,
          fullName: data.fullName, // Use the name from the form
          role: data.role, // Use the role from the form
          status: UserStatus.ACTIVE, // Set status to active
          onboardingComplete: false,
          createdAt: placeholderData.createdAt || serverTimestamp(), // Keep original invite timestamp if it exists
        };
        batch.set(realUserRef, finalProfileData, { merge: true });

        // 3. Delete the old placeholder document
        batch.delete(placeholderDoc.ref);
        
        await batch.commit();

      } else {
        // --- Standard Signup Flow ---
        const userRef = doc(db, "users", user.uid);
        const userProfileData: UserProfileData = {
          uid: user.uid,
          fullName: data.fullName,
          email: normalizedEmail,
          role: data.role,
          status: UserStatus.ACTIVE,
          subscriptionTier: SubscriptionTier.FREE,
          onboardingComplete: false,
          createdAt: serverTimestamp() as any,
          avatarUrl: user.photoURL || "",
          dataAiHint: "",
          canDrive: false,
          bio: "",
          phone: "",
          preferences: {
            notifications: {
              rydUpdates: { email: true, text: false },
              groupActivity: { email: true, text: false },
              parentalApprovals: { email: true, text: false },
              chatMessages: { email: true, text: false },
            },
          },
          address: { street: "", city: "", state: "", zip: "" },
          driverDetails: { ageRange: "", drivingExperience: "", primaryVehicle: "", passengerCapacity: "" },
          managedStudentIds: [],
          associatedParentIds: [],
          approvedDrivers: {},
          declinedDriverIds: [],
          joinedGroupIds: [],
          familyIds: [],
        };
        await setDoc(userRef, userProfileData);
      }

      toast({
        title: "Account Created!",
        description: "Let's get your profile set up.",
      });
      router.push("/onboarding/welcome");

    } catch (error: any) {
      console.error("Signup error:", error);
      let errorMessage = "An unexpected error occurred. Please try again.";
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email address is already registered as an active user.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "The password is too weak. Please ensure it meets all requirements.";
      }
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
        duration: 9000,
      });
    } finally {
      setIsLoading(false);
    }
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
              <PasswordStrength password={passwordValue} />
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
