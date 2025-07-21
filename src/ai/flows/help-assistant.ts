
'use server';
/**
 * @fileOverview An AI-powered help assistant for RydzConnect.
 *
 * - askHelpAssistant - A function that answers user questions based on app documentation.
 * - HelpAssistantInput - The input type for the assistant.
 * - HelpAssistantOutput - The return type for the assistant.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs';
import path from 'path';

const HelpAssistantInputSchema = z.object({
  question: z.string().describe("The user's question about the RydzConnect app."),
  userRole: z.string().optional().describe('The role of the user asking the question (e.g., parent, student).'),
  currentPage: z.string().optional().describe('The current page the user is on (e.g., /dashboard, /profile).'),
});
export type HelpAssistantInput = z.infer<typeof HelpAssistantInputSchema>;

const HelpAssistantOutputSchema = z.object({
  answer: z.string().describe("The helpful answer to the user's question."),
});
export type HelpAssistantOutput = z.infer<typeof HelpAssistantOutputSchema>;

export async function askHelpAssistant(input: HelpAssistantInput): Promise<HelpAssistantOutput> {
  return helpAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'helpAssistantPrompt',
  input: {
    schema: HelpAssistantInputSchema.extend({
      documentationContext: z.string(),
    }),
  },
  output: { schema: HelpAssistantOutputSchema },
  prompt: `You are a friendly and helpful AI assistant for an app called "MyRydz".

Your role is to answer user questions based *only* on the provided documentation context.
Do not make up features or pricing. If the answer is not in the documentation, say "I'm sorry, I don't have information about that. Please contact support for more help."

Keep your answers concise, friendly, and easy to understand.

**User's Current Context:**
- User Role: {{{userRole}}}
- Current Page: {{{currentPage}}}

**Documentation Context:**
---
{{{documentationContext}}}
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

    const { output } = await prompt({ ...input, documentationContext });
    return output!;
  }
);
