
'use server';
/**
 * @fileOverview An AI-powered help assistant for RydzConnect.
 *
 * - askHelpAssistant - A function that answers user questions based on app documentation.
 * - HelpAssistantInput - The input type for the assistant.
 * - HelpAssistantOutput - The return type for the assistant.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const HelpAssistantInputSchema = z.object({
  question: z.string().describe('The user\'s question about the RydzConnect app.'),
  userRole: z.string().optional().describe('The role of the user asking the question (e.g., parent, student).'),
  currentPage: z.string().optional().describe('The current page the user is on (e.g., /dashboard, /profile).'),
});
export type HelpAssistantInput = z.infer<typeof HelpAssistantInputSchema>;

const HelpAssistantOutputSchema = z.object({
  answer: z.string().describe('The helpful answer to the user\'s question.'),
});
export type HelpAssistantOutput = z.infer<typeof HelpAssistantOutputSchema>;

export async function askHelpAssistant(input: HelpAssistantInput): Promise<HelpAssistantOutput> {
  return helpAssistantFlow(input);
}

// NOTE: The content of the markdown files is embedded directly into the prompt.
// This is a simple form of Retrieval-Augmented Generation (RAG).
const documentationContext = `
# RydzConnect Documentation

## Parent Approval Process
- An approval request is initiated when a student requests a ryd with an unapproved driver or when an unapproved driver offers a ryd to their student.
- A parent can add any user to the approved driver list at any time without a request.
- When a parent approves a request, they can either approve it for just the one ryd or add the driver to the approved driver list permanently.
- Parents can see pending approval requests on the "Parental Controls" page.

## Monetization and Pricing
The app has three tiers: Free, Premium, and Organization.
- **Free Tier**: Includes unlimited events and carpools, basic driver approval, and driver ratings.
- **Premium Tier**: Costs $3/month or $25/year. It includes all free features plus route optimization, real-time tracking, calendar integration, driving reports, and support for up to 5 family members.
- **Organization/School Plans**: Priced based on the number of families, with annual and quarterly options available. These plans include all Premium features for all members.

## General App Info
- App Name: RydzConnect
- Core Purpose: A carpooling scheduling application for middle and high school events.
- Key Differentiators: Unlimited free tier, student drivers are allowed, parents have a driver approval system.
`;

const prompt = ai.definePrompt({
  name: 'helpAssistantPrompt',
  input: {schema: HelpAssistantInputSchema},
  output: {schema: HelpAssistantOutputSchema},
  prompt: `You are a friendly and helpful AI assistant for an app called "RydzConnect".

Your role is to answer user questions based *only* on the provided documentation context.
Do not make up features or pricing. If the answer is not in the documentation, say "I'm sorry, I don't have information about that. Please contact support for more help."

Keep your answers concise, friendly, and easy to understand.

**User's Current Context:**
- User Role: {{{userRole}}}
- Current Page: {{{currentPage}}}

**Documentation Context:**
---
${documentationContext}
---

**User's Question:**
"{{{question}}}"

Based on the documentation, provide a helpful answer.
`,
});

const helpAssistantFlow = ai.defineFlow(
  {
    name: 'helpAssistantFlow',
    inputSchema: HelpAssistantInputSchema,
    outputSchema: HelpAssistantOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
