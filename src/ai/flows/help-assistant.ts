
'use server';
/**
 * @fileOverview An AI-powered help assistant for MyRydz that can answer user questions
 * and capture user feedback.
 *
 * - askHelpAssistant - A function that handles user queries, either answering them or saving feedback.
 * - HelpAssistantInput - The input type for the assistant.
 * - HelpAssistantOutput - The return type for the assistant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs';
import path from 'path';
import { saveFeedbackAction } from '@/actions/feedbackActions';

// --- Input and Output Schemas ---
export const HelpAssistantInputSchema = z.object({
  question: z.string().describe("The user's question or feedback about the MyRydz app."),
  userRole: z.string().optional().describe('The role of the user (e.g., parent, student).'),
  currentPage: z.string().optional().describe('The current page the user is on (e.g., /dashboard, /profile).'),
  userId: z.string().optional().describe('The UID of the logged-in user.'),
});
export type HelpAssistantInput = z.infer<typeof HelpAssistantInputSchema>;

export const HelpAssistantOutputSchema = z.object({
  answer: z.string().describe("The helpful answer or acknowledgment to the user's input."),
});
export type HelpAssistantOutput = z.infer<typeof HelpAssistantOutputSchema>;


// --- Main exported function ---
export async function askHelpAssistant(input: HelpAssistantInput): Promise<HelpAssistantOutput> {
  return helpAssistantFlow(input);
}


// --- AI Flow Definition ---

const helpAssistantFlow = ai.defineFlow(
  {
    name: 'helpAssistantFlow',
    inputSchema: HelpAssistantInputSchema,
    outputSchema: HelpAssistantOutputSchema,
  },
  async (input) => {
    // 1. Classify the user's intent
    const classification = await ai.generate({
      prompt: `Classify the user's intent as either "question" or "feedback".

      - "question": The user is asking for help, instructions, or information.
      - "feedback": The user is providing an opinion, suggestion, bug report, or feature request.
      
      User input: "${input.question}"`,
      output: {
        schema: z.enum(['question', 'feedback']),
      },
      model: 'googleai/gemini-2.0-flash', 
    });
    
    const intent = classification.output;

    // 2. Handle based on intent
    if (intent === 'feedback') {
      // Save the feedback to Firestore
      await saveFeedbackAction({
        userId: input.userId,
        feedbackText: input.question,
        context: {
          page: input.currentPage,
          role: input.userRole,
        },
      });
      // Return a friendly acknowledgment
      return {
        answer: "Thank you for your feedback! We've saved it for the development team to review. Is there anything else I can help with?",
      };
    } else { // intent is 'question'
      // Dynamically read documentation from the /readme directory
      let documentationContext = '';
      try {
        const readmeDir = path.join(process.cwd(), 'readme');
        const files = fs.readdirSync(readmeDir);
        const markdownFiles = files.filter(file => file.endsWith('.md'));

        for (const file of markdownFiles) {
          const content = fs.readFileSync(path.join(readmeDir, file), 'utf-8');
          documentationContext += `\n\n## Documentation from ${file}\n\n${content}`;
        }
      } catch (error) {
        console.error("Error reading help documentation files:", error);
        documentationContext = "No documentation could be loaded. Please notify the administrator.";
      }

      const { output } = await ai.generate({
          prompt: `You are a friendly and helpful AI assistant for an app called "MyRydz".

Your role is to answer user questions based *only* on the provided documentation context.
Do not make up features or pricing. If the answer is not in the documentation, say "I'm sorry, I don't have information about that. Please contact support for more help."

Keep your answers concise, friendly, and easy to understand.

**User's Current Context:**
- User Role: ${input.userRole}
- Current Page: ${input.currentPage}

**Documentation Context:**
---
${documentationContext}
---

**User's Question:**
"${input.question}"

Based on the documentation, provide a helpful answer.`,
        output: {
            schema: HelpAssistantOutputSchema
        },
        model: 'googleai/gemini-2.0-flash', 
      });

      return output || { answer: "I'm sorry, I had trouble generating a response." };
    }
  }
);
