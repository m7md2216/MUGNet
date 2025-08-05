import OpenAI from "openai";

export interface DynamicRelationship {
  fromEntity: string;
  toEntity: string;
  relationshipType: string;
  confidence: number;
  context: string;
  timestamp: Date;
}

export class DynamicRelationshipExtractor {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async extractRelationships(message: string, messageContext: {
    sender: string;
    timestamp: Date;
    conversationHistory?: string[];
  }): Promise<DynamicRelationship[]> {
    try {
      console.log('🔍 Extracting dynamic relationships from message:', message);

      const prompt = `
Analyze this conversation message and intelligently extract ALL meaningful relationships between people, activities, preferences, objects, and concepts.

Message: "${message}"
Sender: ${messageContext.sender}
Context: ${messageContext.conversationHistory?.slice(-3).join(' | ') || 'No prior context'}

CORE PRINCIPLE: Extract relationships about WHO or WHAT the message content discusses, not just the sender.

RELATIONSHIP INTELLIGENCE:
- Detect preferences: "I love X", "on repeat", "favorite", "can't stand", "hate"
- Detect actions: "went to", "watched", "listened to", "ate", "bought"  
- Detect states: "is tired", "feels excited", "misses", "worried about"
- Detect comparisons: "prefers X over Y", "better than", "worse than"
- Detect ownership: "has", "owns", "got", "bought"
- Detect experiences: "encountered", "met", "saw", "heard"
- Detect habits: "always", "never", "usually", "often", "sometimes"

INTELLIGENT RELATIONSHIP NAMING:
Instead of predefined types, CREATE descriptive relationship names that capture the exact meaning:
- "loves chocolate" → ENJOYS_FOOD
- "has on repeat" → LISTENS_REPEATEDLY  
- "can't stand heights" → FEARS
- "went camping" → EXPERIENCED_ACTIVITY
- "misses someone" → EMOTIONALLY_ATTACHED_TO
- "prefers tea over coffee" → PREFERS_OVER
- "always eats spicy food" → HABITUALLY_CONSUMES

Extract relationships in this JSON format:
{
  "relationships": [
    {
      "fromEntity": "person/entity the relationship is about",
      "toEntity": "object/concept of the relationship", 
      "relationshipType": "INTELLIGENT_DESCRIPTIVE_NAME",
      "confidence": 0.0-1.0,
      "context": "brief explanation of what this relationship means"
    }
  ]
}

THINK CREATIVELY: What relationships would be useful for answering questions about people's preferences, experiences, and connections? Extract everything that gives insight into who people are and what they like/dislike/do.
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: "You are an expert at extracting semantic relationships from conversational text. Focus on meaningful, specific relationships rather than generic ones." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{"relationships": []}');
      
      const relationships: DynamicRelationship[] = result.relationships.map((rel: any) => ({
        fromEntity: rel.fromEntity,
        toEntity: rel.toEntity,
        relationshipType: rel.relationshipType,
        confidence: rel.confidence || 0.5,
        context: rel.context || '',
        timestamp: messageContext.timestamp
      }));

      console.log(`✅ Extracted ${relationships.length} dynamic relationships:`, relationships);
      return relationships;

    } catch (error) {
      console.error('❌ Failed to extract dynamic relationships:', error);
      return [];
    }
  }

  async inferPersonalRelationships(messages: string[], people: string[]): Promise<DynamicRelationship[]> {
    try {
      if (people.length < 2) return [];

      console.log('🤝 Inferring relationships between people:', people);

      const conversationContext = messages.slice(-10).join('\n');
      
      const prompt = `
Analyze this conversation and infer relationships between these people: ${people.join(', ')}

Conversation:
${conversationContext}

Based on how they interact, what relationships can you infer? Consider:
- Friendship levels (CLOSE_FRIENDS, CASUAL_FRIENDS, ACQUAINTANCES)
- Shared experiences (CAMPING_BUDDIES, MOVIE_PARTNERS, COLLEAGUES)
- Similar interests (SHARE_MUSIC_TASTE, BOTH_OUTDOORSY, SIMILAR_HOBBIES)
- Social dynamics (FREQUENTLY_CHATS_WITH, OFTEN_AGREES_WITH, TEASES_PLAYFULLY)

Extract in JSON format:
{
  "relationships": [
    {
      "fromEntity": "Person1",
      "toEntity": "Person2",
      "relationshipType": "SPECIFIC_RELATIONSHIP_TYPE",
      "confidence": 0.7,
      "context": "evidence from conversation"
    }
  ]
}
`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an expert at understanding social dynamics and relationships from conversation patterns." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      });

      const result = JSON.parse(response.choices[0].message.content || '{"relationships": []}');
      
      const relationships: DynamicRelationship[] = result.relationships.map((rel: any) => ({
        fromEntity: rel.fromEntity,
        toEntity: rel.toEntity,
        relationshipType: rel.relationshipType,
        confidence: rel.confidence || 0.5,
        context: rel.context || '',
        timestamp: new Date()
      }));

      console.log(`✅ Inferred ${relationships.length} personal relationships:`, relationships);
      return relationships;

    } catch (error) {
      console.error('❌ Failed to infer personal relationships:', error);
      return [];
    }
  }
}

export const dynamicRelationshipExtractor = new DynamicRelationshipExtractor();