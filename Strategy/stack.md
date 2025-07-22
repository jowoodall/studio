# MyRydz Technical Stack

This document outlines the core technologies and frameworks used to build the MyRydz application.

## Core Stack

- **Framework**: **Next.js (App Router)** - The primary React framework for building the user interface. The App Router provides server components for improved performance and a structured routing system.
- **Language**: **TypeScript** - Ensures type safety and improves code quality and maintainability across the entire codebase.
- **UI Library**: **React** - The foundational library for building user interface components.

## Backend & Database

- **Platform**: **Firebase** - Provides a suite of tools for backend services.
  - **Authentication**: Manages user signup, login, and session management.
  - **Firestore**: A NoSQL, document-based database used for storing all application data, including user profiles, rydz, events, and groups.
  - **App Hosting**: Hosts the Next.js application.

## UI & Styling

- **Component Library**: **shadcn/ui** - A collection of reusable UI components that are used throughout the application for a consistent look and feel.
- **Styling**: **Tailwind CSS** - A utility-first CSS framework used for all styling.

## Generative AI

- **AI Toolkit**: **Genkit** - The framework used for all generative AI functionality, such as the in-app help assistant. It integrates with Google's Gemini models.

## Forms & Validation

- **Form Management**: **React Hook Form** - Handles form state and submission logic.
- **Schema Validation**: **Zod** - Used in conjunction with React Hook Form to define data schemas and validate form inputs.

## Security

- **Bot Protection**: **Google reCAPTCHA v3** - Protects user-facing forms, like the signup page, from automated abuse.
