import OpenAI from "openai";
import { type User, type InsertMessage } from "@shared/schema";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateExampleConversations(users: User[]): Promise<InsertMessage[]> {
  // The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user
  const userNames = users.map(u => u.name);
  
  const conversationPrompt = `Generate a realistic group chat conversation between these users: ${userNames.join(", ")}. 

Create a natural, engaging conversation that includes:
- Casual greetings and small talk
- References to activities (hiking, restaurants, travel, work, hobbies)
- Mentions of specific places (cities, restaurants, parks, etc.)
- Some @mentions between users
- A few questions that could be answered later (to test the AI's memory)
- Mix of short and longer messages
- Natural conversation flow with some time gaps

Make it feel like real friends chatting. Include 12-15 messages total.
Each message should be realistic and conversational.

IMPORTANT: Return a JSON object with a "messages" array containing exactly 12-15 message objects.

{
  "messages": [
    {
      "sender": "${userNames[0]}",
      "content": "Hey everyone! How's your weekend going?",
      "mentions": []
    },
    {
      "sender": "${userNames[1]}", 
      "content": "@${userNames[0]} pretty good! Just got back from hiking at Valley Forge",
      "mentions": ["${userNames[0]}"]
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: conversationPrompt }],
      response_format: { type: "json_object" },
      max_tokens: 2000,
      temperature: 0.8,
    });

    const result = JSON.parse(response.choices[0].message.content || '{"messages": []}');
    const messages = result.messages || [];
    
    // Convert to InsertMessage format
    const insertMessages: InsertMessage[] = [];
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const user = users.find(u => u.name === msg.sender);
      
      if (user) {
        insertMessages.push({
          userId: user.id,
          content: msg.content,
          mentions: msg.mentions || [],
        });
      }
    }
    
    return insertMessages;
    
  } catch (error) {
    console.error('Failed to generate conversation examples:', error);
    
    // Fallback: Create basic examples if OpenAI fails
    return generateFallbackExamples(users);
  }
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