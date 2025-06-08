
// src/ai/flows/carpool-matching.ts
'use server';

/**
 * @fileOverview Carpool matching AI agent.
 *
 * - carpoolMatching - A function that suggests the closest possible carpools to a destination, considering traffic and associated groups.
 * - CarpoolMatchingInput - The input type for the carpoolMatching function.
 * - CarpoolMatchingOutput - The return type for the carpoolMatching function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CarpoolMatchingInputSchema = z.object({
  eventLocation: z
    .string()
    .describe('The full address of the event location.'),
  eventDateTime: z.string().describe('The date and time of the event (ISO format).'),
  userLocation: z
    .string()
    .describe('The full address of the user requesting the ryd.'),
  trafficConditions: z
    .string()
    .describe('Current and forecasted traffic conditions in the area.'),
  associatedGroups: z // Changed from knownCarpools
    .array(z.string())
    .describe('A list of group names or IDs associated with this carpool request. These groups should be prioritized if possible. If none, this will be an empty array.'),
});
export type CarpoolMatchingInput = z.infer<typeof CarpoolMatchingInputSchema>;

const CarpoolMatchingOutputSchema = z.object({
  suggestedCarpools: z
    .array(z.string())
    .describe('A list of the closest possible carpools, with driver name and estimated arrival time.'),
  reasoning: z.string().describe('The AI reasoning for the carpool suggestions.'),
});
export type CarpoolMatchingOutput = z.infer<typeof CarpoolMatchingOutputSchema>;

export async function carpoolMatching(input: CarpoolMatchingInput): Promise<CarpoolMatchingOutput> {
  return carpoolMatchingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'carpoolMatchingPrompt',
  input: {schema: CarpoolMatchingInputSchema},
  output: {schema: CarpoolMatchingOutputSchema},
  prompt: `You are an AI carpool assistant. A student is requesting a ryd to an event.
  Suggest the closest possible carpools to the destination, considering traffic patterns and any associated groups.

  Event Location: {{{eventLocation}}}
  Event Date and Time: {{{eventDateTime}}}
  User Location: {{{userLocation}}}
  Traffic Conditions: {{{trafficConditions}}}
  {{#if associatedGroups.length}}
  Associated Groups (prioritize these if members are available):
  {{#each associatedGroups}}
  - {{{this}}}
  {{/each}}
  {{else}}
  No specific groups associated with this request.
  {{/if}}

  Provide a list of suggested carpools including driver name and estimated arrival time.
  Also, explain your reasoning for suggesting these carpools, particularly how associated groups influenced the decision if applicable.
  If no carpools are known or can be formed from associated groups, suggest forming a new one.
  `,
});

const carpoolMatchingFlow = ai.defineFlow(
  {
    name: 'carpoolMatchingFlow',
    inputSchema: CarpoolMatchingInputSchema,
    outputSchema: CarpoolMatchingOutputSchema,
  },
  async input => {
    // Ensure associatedGroups is always an array, even if undefined from older form versions
    const sanitizedInput = {
      ...input,
      associatedGroups: input.associatedGroups || [],
    };
    const {output} = await prompt(sanitizedInput);
    return output!;
  }
);
