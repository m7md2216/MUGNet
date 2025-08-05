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
Analyze this conversation message and extract meaningful relationships between people, places, activities, and concepts.

CRITICAL: Extract relationships about the entities MENTIONED IN THE MESSAGE CONTENT, not about the message sender.

Message: "${message}"
Sender: ${messageContext.sender}
Context: ${messageContext.conversationHistory?.slice(-3).join(' | ') || 'No prior context'}

IMPORTANT DISTINCTION:
- Message Sender: The person who wrote/sent the message (${messageContext.sender})
- Message Subject: The people/entities that the message content is ABOUT

Extract relationships about the SUBJECTS mentioned in the message content, NOT the sender.

Examples:
- If Ali says "Jake loves rock climbing" → Extract: Jake --[ENJOYS_ACTIVITY]--> rock climbing
- If Sarah says "Emma went to Paris" → Extract: Emma --[VISITED]--> Paris
- If Ryan says "I like jazz music" → Extract: Ryan --[ENJOYS_GENRE]--> jazz music

Extract relationships in this JSON format:
{
  "relationships": [
    {
      "fromEntity": "person/place/thing mentioned in content",
      "toEntity": "person/place/thing mentioned in content", 
      "relationshipType": "descriptive relationship type",
      "confidence": 0.8,
      "context": "brief explanation"
    }
  ]
}

Relationship types should be semantic and meaningful, such as:
- EXPERIENCED_AT (Jake EXPERIENCED_AT Yosemite)
- WATCHED_WITH (Emma WATCHED_WITH Ryan)
- PREFERS_OVER (Ryan PREFERS_OVER rock)
- VISITED_FOR (Jake VISITED_FOR camping)
- DISLIKES_GENRE (Ryan DISLIKES_GENRE country)
- LISTENS_TO_REPEATEDLY (Emma LISTENS_TO_REPEATEDLY "Midnight Reverie")
- HAS_ON_REPEAT (Emma HAS_ON_REPEAT "song name")
- WATCHES_SHOW (group WATCHES_SHOW "TV show name")
- ENJOYS_FOOD (Emma ENJOYS_FOOD "burrito with hot sauce")
- WORKS_AT, LIVES_IN, ENJOYS_ACTIVITY, RECOMMENDS_TO, etc.

Only extract relationships that are clearly stated or strongly implied. Include confidence scores (0.0-1.0).
Focus on what the message content says ABOUT the people/entities mentioned, not about who sent the message.
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