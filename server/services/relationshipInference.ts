import OpenAI from 'openai';
import { Message, User } from '@shared/schema';
import { neo4jService } from './neo4j';
import { storage } from '../storage';

export interface InferredRelationship {
  user1: string;
  user2: string;
  relationshipType: 'FRIENDS_WITH' | 'WORKS_WITH' | 'FAMILY' | 'UNKNOWN';
  confidence: number;
  inferredFromMessageId: number;
}

export class RelationshipInferenceService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async processMessage(message: Message): Promise<void> {
    try {
      // Extract mentions from message content
      const mentionMatches = message.content.match(/@(\w+)/g);
      const mentions = mentionMatches ? mentionMatches.map(match => match.replace('@', '')) : [];
      
      console.log('🔍 Relationship inference processing:', {
        messageId: message.id,
        content: message.content,
        extractedMentions: mentions
      });

      if (mentions.length === 0) {
        console.log('No mentions found, skipping relationship inference');
        return;
      }

      // Get the sender user
      const sender = await storage.getUser(message.userId!);
      if (!sender) {
        console.log('Sender user not found, skipping relationship inference');
        return;
      }

      // Get recent context for better inference
      const recentMessages = await storage.getAllMessages();
      const lastThreeMessages = recentMessages.slice(-3);

      // Infer relationships between sender and mentioned users
      for (const mentionedUserName of mentions) {
        console.log(`Looking for user: "${mentionedUserName}"`);
        const mentionedUser = await storage.getUserByName(mentionedUserName);
        
        if (!mentionedUser) {
          console.log(`User "${mentionedUserName}" not found in database`);
          continue;
        }
        
        if (mentionedUser.id === sender.id) {
          console.log(`User "${mentionedUserName}" is the same as sender, skipping`);
          continue;
        }

        console.log(`Inferring relationship between ${sender.name} and ${mentionedUser.name}`);
        
        const relationship = await this.inferRelationship(
          sender,
          mentionedUser,
          message,
          lastThreeMessages
        );

        if (relationship) {
          console.log(`Relationship inferred: ${relationship.relationshipType} (confidence: ${relationship.confidence})`);
          
          if (relationship.relationshipType !== 'UNKNOWN') {
            await this.updateRelationshipGraph(relationship);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to process relationship inference:', error);
    }
  }

  private async inferRelationship(
    user1: User,
    user2: User,
    currentMessage: Message,
    recentContext: Message[]
  ): Promise<InferredRelationship | null> {
    try {
      // Build context from recent messages
      const contextLines = recentContext
        .map(msg => {
          const senderName = msg.userId === user1.id ? user1.name : 
                           msg.userId === user2.id ? user2.name : 'Unknown';
          return `${senderName}: ${msg.content}`;
        })
        .slice(-3) // Last 3 lines
        .join('\n');

      // Add current message
      const currentLine = `${user1.name}: ${currentMessage.content}`;
      const fullContext = contextLines + '\n' + currentLine;

      const prompt = `You are a social reasoning assistant. Infer the most likely relationship between two users based on a short chat exchange.

Examples:

Ali: I went skiing with my buddy Sam this weekend.
Sam: Yeah, Ali totally bailed halfway through 😂
Relationship: FRIENDS_WITH

Zara: I'll check with my boss, Alex, before we proceed.
Alex: Let me know what he says.
Relationship: WORKS_WITH

Layla: My cousin Fatima just graduated from NYU!
Fatima: Thanks Layla 😄
Relationship: FAMILY

User A: Hi.
User B: Hello.
Relationship: UNKNOWN

${fullContext}
Relationship:`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 20
      });

      const relationshipText = response.choices[0].message.content?.trim() || 'UNKNOWN';
      
      // Parse the relationship type
      let relationshipType: 'FRIENDS_WITH' | 'WORKS_WITH' | 'FAMILY' | 'UNKNOWN' = 'UNKNOWN';
      if (relationshipText.includes('FRIENDS_WITH')) {
        relationshipType = 'FRIENDS_WITH';
      } else if (relationshipText.includes('WORKS_WITH')) {
        relationshipType = 'WORKS_WITH';
      } else if (relationshipText.includes('FAMILY')) {
        relationshipType = 'FAMILY';
      }

      return {
        user1: user1.name,
        user2: user2.name,
        relationshipType,
        confidence: relationshipType === 'UNKNOWN' ? 0.1 : 0.8,
        inferredFromMessageId: currentMessage.id
      };

    } catch (error) {
      console.error('Failed to infer relationship:', error);
      return null;
    }
  }

  private async updateRelationshipGraph(relationship: InferredRelationship): Promise<void> {
    try {
      // Create or update relationship in Neo4j
      await neo4jService.createOrUpdateRelationship(
        relationship.user1,
        relationship.user2,
        relationship.relationshipType,
        {
          confidence: relationship.confidence,
          inferredFromMessageId: relationship.inferredFromMessageId,
          lastUpdated: new Date().toISOString()
        }
      );

      console.log(`Inferred relationship: ${relationship.user1} ${relationship.relationshipType} ${relationship.user2} (confidence: ${relationship.confidence})`);
    } catch (error) {
      console.error('Failed to update relationship graph:', error);
    }
  }
}

export const relationshipInferenceService = new RelationshipInferenceService();