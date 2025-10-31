import { Injectable } from "@nestjs/common";

@Injectable()
export class PromptService {
  
  buildPrompt(similarChunks: any, titles: string[], messages: any, question: string): string {
    return [
      `We are discussing the YouTube videos: ${titles.join(', ')}`,
      'Use the transcript snippets and conversation history to ground the answer.',
      'If information is missing, be honest about not knowing rather than guessing.',
      '',
      'Transcript snippets:',
      similarChunks.map(chunk => `- ${chunk.title}: ${chunk.content}`).join('\n'),
      '',
      'Relevant conversation memories:',
      messages.map(message => `${message.role}: ${message.content}`).join('\n'),
      '',
      `User question: ${question}`,
      '',
      'Craft a helpful and concise reply that addresses the user\'s question based on the provided context.',
    ].join('\n');
  }
}