import OpenAI from "openai";
import { storage } from "../storage";
import { type Message, type User } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface AIResponse {
  response: string;
  extractedEntities: {
    people: string[];
    topics: string[];
    events: string[];
    dates: string[];
  };
  relevantContext: string[];
}

export async function generateAIResponse(
  mentionedUsers: string[],
  messageContent: string,
  currentUser: User,
  conversationHistory: Message[]
): Promise<AIResponse> {
  try {
    // Get conversation history for mentioned users
    const contextualMessages = await getContextualMessages(mentionedUsers, conversationHistory);
    
    // Get relevant entities and relationships
    const knowledgeContext = await getKnowledgeContext(mentionedUsers);
    
    const systemPrompt = `You are an AI agent in a group chat. You have access to a knowledge graph containing conversation history, user relationships, and contextual information.

Your capabilities:
1. Respond when mentioned with @agent or similar
2. Access conversation history for personalized responses
3. Identify entities (people, topics, events, dates) from conversations
4. Map relationships between users and topics
5. Provide context-aware responses based on previous conversations

Current conversation context:
- User asking: ${currentUser.name}
- Mentioned users: ${mentionedUsers.join(', ')}
- Recent conversation history: ${JSON.stringify(contextualMessages)}
- Knowledge graph context: ${JSON.stringify(knowledgeContext)}

Instructions:
- Be helpful and contextual
- Reference previous conversations when relevant
- Identify and extract entities for knowledge graph updates
- Respond in a natural, conversational tone
- Keep responses concise but informative

Respond with JSON in this format:
{
  "response": "Your conversational response here",
  "extractedEntities": {
    "people": ["array of person names mentioned"],
    "topics": ["array of topics discussed"],
    "events": ["array of events mentioned"],
    "dates": ["array of dates mentioned"]
  },
  "relevantContext": ["array of relevant context points used"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageContent }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      response: result.response || "I'm sorry, I couldn't process that request.",
      extractedEntities: result.extractedEntities || {
        people: [],
        topics: [],
        events: [],
        dates: []
      },
      relevantContext: result.relevantContext || []
    };

  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate AI response: " + (error as Error).message);
  }
}

async function getContextualMessages(mentionedUsers: string[], conversationHistory: Message[]): Promise<Message[]> {
  // Get recent messages from mentioned users
  const relevantMessages = conversationHistory
    .filter(msg => {
      // Include messages from mentioned users or messages that mention them
      const userMatches = mentionedUsers.some(userName => {
        const user = storage.getUserByName(userName);
        return user && msg.userId === user.id;
      });
      
      const mentionMatches = mentionedUsers.some(userName => 
        msg.mentions.includes(userName.toLowerCase())
      );
      
      return userMatches || mentionMatches;
    })
    .slice(-10); // Last 10 relevant messages

  return relevantMessages;
}

async function getKnowledgeContext(mentionedUsers: string[]): Promise<any> {
  const entities = await storage.getAllKnowledgeGraphEntities();
  const relationships = await storage.getAllKnowledgeGraphRelationships();
  
  // Filter entities related to mentioned users
  const relevantEntities = entities.filter(entity => 
    mentionedUsers.some(user => 
      entity.name.toLowerCase().includes(user.toLowerCase()) ||
      entity.type === 'person' && entity.name === user
    )
  );
  
  // Get relationships involving these entities
  const relevantRelationships = relationships.filter(rel => 
    relevantEntities.some(entity => 
      entity.id === rel.fromEntityId || entity.id === rel.toEntityId
    )
  );

  return {
    entities: relevantEntities,
    relationships: relevantRelationships
  };
}

export async function extractAndStoreEntities(
  messageId: number,
  extractedEntities: AIResponse['extractedEntities'],
  participants: string[]
): Promise<void> {
  try {
    const allEntities = [
      ...extractedEntities.people.map(name => ({ name, type: 'person' })),
      ...extractedEntities.topics.map(name => ({ name, type: 'topic' })),
      ...extractedEntities.events.map(name => ({ name, type: 'event' })),
      ...extractedEntities.dates.map(name => ({ name, type: 'date' }))
    ];

    // Create entities and relationships
    for (const entityData of allEntities) {
      let entity = await storage.getKnowledgeGraphEntityByName(entityData.name);
      
      if (!entity) {
        entity = await storage.createKnowledgeGraphEntity({
          name: entityData.name,
          type: entityData.type,
          properties: {}
        });
      }

      // Create relationships between people and other entities
      if (entityData.type === 'person') {
        for (const participant of participants) {
          if (participant !== entityData.name) {
            const participantEntity = await storage.getKnowledgeGraphEntityByName(participant);
            if (participantEntity) {
              await storage.createKnowledgeGraphRelationship({
                fromEntityId: participantEntity.id,
                toEntityId: entity.id,
                relationshipType: 'mentions',
                properties: {},
                messageId
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Error extracting and storing entities:", error);
  }
}
