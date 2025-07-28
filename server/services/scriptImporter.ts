import type { User, InsertMessage } from "@shared/schema";
import { storage } from "../storage";

interface ParsedMessage {
  speaker: string;
  content: string;
  mentions: string[];
  day: number;
  isAiTest: boolean;
}

export class ScriptImporter {
  private async ensureUsersExist(userNames: string[]): Promise<Map<string, User>> {
    const userMap = new Map<string, User>();
    
    for (const name of userNames) {
      let user = await storage.getUserByName(name);
      if (!user) {
        // Create new user with initials and color
        const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
        const colors = ['blue', 'green', 'purple', 'red', 'orange', 'pink', 'indigo'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        user = await storage.createUser({
          name,
          initials,
          color
        });
      }
      userMap.set(name, user);
    }
    
    return userMap;
  }

  private parseScript(scriptContent: string): ParsedMessage[] {
    const lines = scriptContent.split('\n');
    const messages: ParsedMessage[] = [];
    let currentDay = 1;
    let isInTestPhase = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and stage directions
      if (!trimmedLine || trimmedLine.startsWith('(') || trimmedLine.startsWith('***')) {
        continue;
      }
      
      // Detect day transitions
      const dayMatch = trimmedLine.match(/^Day (\d+)/);
      if (dayMatch) {
        currentDay = parseInt(dayMatch[1]);
        isInTestPhase = currentDay >= 11; // Days 11-15 are AI evaluation tests
        continue;
      }
      
      // Parse message format: "Speaker: message content"
      const messageMatch = trimmedLine.match(/^([^:]+): (.+)$/);
      if (messageMatch) {
        const speaker = messageMatch[1].trim();
        const content = messageMatch[2].trim();
        
        // Extract @mentions
        const mentions = content.match(/@(\w+)/g)?.map(m => m.substring(1)) || [];
        
        messages.push({
          speaker,
          content,
          mentions,
          day: currentDay,
          isAiTest: isInTestPhase
        });
      }
    }
    
    return messages;
  }

  async importScript(scriptContent: string): Promise<{
    conversationMessages: number;
    testMessages: number;
    totalMessages: number;
    users: string[];
  }> {
    const parsedMessages = this.parseScript(scriptContent);
    
    // Get unique speakers (excluding AI)
    const speakerSet = new Set(parsedMessages.map(m => m.speaker));
    const uniqueSpeakers = Array.from(speakerSet)
      .filter(speaker => speaker.toLowerCase() !== 'ai');
    
    // Ensure all users exist
    const userMap = await this.ensureUsersExist(uniqueSpeakers);
    
    let conversationCount = 0;
    let testCount = 0;
    
    // Import messages in chronological order
    for (const parsed of parsedMessages) {
      const user = userMap.get(parsed.speaker);
      if (!user) continue; // Skip AI messages for now
      
      const insertMessage: InsertMessage = {
        userId: user.id,
        content: parsed.content,
        mentions: parsed.mentions,
      };
      
      await storage.createMessage(insertMessage);
      
      if (parsed.isAiTest) {
        testCount++;
      } else {
        conversationCount++;
      }
    }
    
    return {
      conversationMessages: conversationCount,
      testMessages: testCount,
      totalMessages: conversationCount + testCount,
      users: uniqueSpeakers
    };
  }
}

export const scriptImporter = new ScriptImporter();