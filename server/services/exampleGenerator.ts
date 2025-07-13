import OpenAI from "openai";
import { type User, type InsertMessage } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateExampleConversations(users: User[]): Promise<InsertMessage[]> {
  // The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user
  const userNames = users.map(u => u.name);
  
  // Use fallback examples for reliable generation
  return generateFallbackExamples(users);
}

function generateFallbackExamples(users: User[]): InsertMessage[] {
  const examples = [
    { content: "Hey everyone! How's your day going?", mentions: [] },
    { content: "Pretty good! Just finished a hiking trip in Pennsylvania", mentions: [] },
    { content: "That sounds amazing! I love hiking. Where did you go exactly?", mentions: [] },
    { content: "Blue Mountain area - the views were incredible", mentions: [] },
    { content: "I went to the beach the day after my hike. Perfect way to relax!", mentions: [] },
    { content: "@{user1} we should plan a group trip sometime", mentions: ["{user1}"] },
    { content: "That's a great idea! I know some good spots", mentions: [] },
    { content: "Anyone want to grab dinner this week? I found this amazing Italian place", mentions: [] },
    { content: "I'm in! Love Italian food", mentions: [] },
    { content: "What's it called? I'm always looking for new restaurants", mentions: [] },
    { content: "Marco's Bistro in downtown. Their pasta is incredible", mentions: [] },
    { content: "Added it to my list! Thanks for the recommendation", mentions: [] },
  ];
  
  const insertMessages: InsertMessage[] = [];
  const now = new Date();
  
  for (let i = 0; i < examples.length; i++) {
    const userIndex = i % users.length;
    const user = users[userIndex];
    const example = examples[i];
    
    // Replace placeholder with actual user name
    const content = example.content.replace('{user1}', users[0].name);
    const mentions = example.mentions.map(m => m.replace('{user1}', users[0].name));
    
    insertMessages.push({
      userId: user.id,
      content,
      mentions,
    });
  }
  
  return insertMessages;
}