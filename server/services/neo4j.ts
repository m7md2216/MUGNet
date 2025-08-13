import neo4j, { Driver, Session } from 'neo4j-driver';
import { User, Message } from '@shared/schema';

interface Neo4jNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface Neo4jRelationship {
  id: string;
  type: string;
  startNode: string;
  endNode: string;
  properties: Record<string, any>;
}

interface MessageContext {
  message: Message;
  sender: User;
  recipients: User[];
  topics: string[];
  timestamp: Date;
}

export class Neo4jService {
  private driver: Driver;
  public session: Session | null = null;

  constructor() {
    // For development, we'll use Neo4j Desktop or Aura connection
    const neo4jUri = process.env.NEO4J_URI || 'neo4j://localhost:7687';
    const neo4jUsername = process.env.NEO4J_USERNAME || 'neo4j';
    const neo4jPassword = process.env.NEO4J_PASSWORD || 'neo4j';
    
    console.log('Neo4j Configuration:', {
      uri: neo4jUri,
      username: neo4jUsername,
      password: '***hidden***'
    });
    
    this.driver = neo4j.driver(
      neo4jUri,
      neo4j.auth.basic(neo4jUsername, neo4jPassword),
      {
        // For Neo4j 4.0+ compatibility
        disableLosslessIntegers: true
      }
    );
  }

  async connect(): Promise<void> {
    try {
      this.session = this.driver.session();
      await this.session.run('RETURN 1');
      console.log('Connected to Neo4j database');
      await this.createIndexes();
    } catch (error) {
      console.warn('Neo4j connection failed, using fallback mode:', error);
      // Continue without Neo4j - the system will work without it
    }
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS FOR (u:User) ON (u.name)',
      'CREATE INDEX IF NOT EXISTS FOR (m:Message) ON (m.id)',
      'CREATE INDEX IF NOT EXISTS FOR (m:Message) ON (m.timestamp)',
      'CREATE INDEX IF NOT EXISTS FOR (t:Topic) ON (t.name)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.name)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.type)'
    ];

    for (const index of indexes) {
      const session = this.driver.session();
      try {
        await session.run(index);
      } catch (error) {
        console.warn('Failed to create index:', error);
      } finally {
        await session.close();
      }
    }
  }

  async syncUser(user: User): Promise<void> {
    if (!this.session) return;

    try {
      await this.session.run(
        `MERGE (u:User {name: $name})
         SET u.id = $id, u.initials = $initials, u.color = $color, u.lastActiveAt = $lastActiveAt`,
        {
          id: user.id,
          name: user.name,
          initials: user.initials,
          color: user.color,
          lastActiveAt: user.lastActiveAt?.toISOString() || null
        }
      );
    } catch (error) {
      console.warn('Failed to sync user to Neo4j:', error);
    }
  }

  async syncMessage(messageContext: MessageContext): Promise<void> {
    if (!this.session) return;

    try {
      const { message, sender, recipients, topics } = messageContext;

      // Create message node
      await this.session.run(
        `MERGE (m:Message {id: $id})
         SET m.text = $text, m.timestamp = $timestamp, m.mentions = $mentions`,
        {
          id: message.id.toString(),
          text: message.content,
          timestamp: message.timestamp?.toISOString() || new Date().toISOString(),
          mentions: message.mentions || []
        }
      );

      // Create sender relationship
      await this.session.run(
        `MATCH (u:User {name: $senderName}), (m:Message {id: $messageId})
         MERGE (u)-[:SENT]->(m)`,
        {
          senderName: sender.name,
          messageId: message.id.toString()
        }
      );

      // Create recipient relationships
      for (const recipient of recipients) {
        await this.session.run(
          `MATCH (u:User {name: $recipientName}), (m:Message {id: $messageId})
           MERGE (m)-[:TO]->(u)`,
          {
            recipientName: recipient.name,
            messageId: message.id.toString()
          }
        );
      }

      // Create topic relationships
      for (const topic of topics) {
        await this.session.run(
          `MERGE (t:Topic {name: $topicName})
           WITH t
           MATCH (m:Message {id: $messageId})
           MERGE (m)-[:MENTIONS]->(t)`,
          {
            topicName: topic,
            messageId: message.id.toString()
          }
        );
      }

      // Add entity extraction for comprehensive knowledge graph (skip for AI responses)
      if (!message.isAiResponse) {
        await this.extractAndStoreEntities(message.content, message.id.toString());
        
        // Add dynamic relationship extraction
        await this.extractAndStoreDynamicRelationships(messageContext);
      } else {
        console.log('🤖 Skipping entity and relationship extraction for AI response in syncMessage');
      }
      
    } catch (error) {
      console.warn('Failed to sync message to Neo4j:', error);
    }
  }

  async extractAndStoreEntities(content: string, messageId: string, isAiResponse?: boolean): Promise<void> {
    console.log('🔧 Neo4j extractAndStoreEntities called, session exists:', !!this.session);
    
    // Skip AI responses to prevent feedback loop
    if (isAiResponse) {
      console.log('🤖 Skipping entity extraction for AI response');
      return;
    }
    
    if (!this.session) {
      console.log('❌ No Neo4j session, skipping entity extraction');
      return;
    }

    try {
      const entities = await this.extractEntitiesFromText(content);
      console.log('🔍 Extracted entities for message:', messageId, entities);
      
      // Import storage to also save to PostgreSQL for AI context
      const { storage } = await import("../storage");
      
      // Only store entities that are actually meaningful and relevant
      // Store People entities (only @mentions)
      for (const person of entities.people) {
        if (person.length > 2) { // Only store names longer than 2 characters
          // Store in Neo4j
          await this.session.run(
            `MERGE (e:Entity {name: $name, type: 'Person'})
             WITH e
             MATCH (m:Message {id: $messageId})
             MERGE (m)-[:MENTIONS]->(e)`,
            { name: person, messageId }
          );
          
          // Note: Knowledge graph now stored exclusively in Neo4j
        }
      }

      // Store only the most relevant location/activity entities  
      for (const event of entities.events) {
        if (event.length > 3) { // Only store events longer than 3 characters
          // Store in Neo4j
          await this.session.run(
            `MERGE (e:Entity {name: $name, type: 'Location'})
             WITH e
             MATCH (m:Message {id: $messageId})
             MERGE (m)-[:DISCUSSES]->(e)`,
            { name: event, messageId }
          );
          
          // Note: Knowledge graph now stored exclusively in Neo4j
        }
      }

      // Store only meaningful date references
      for (const date of entities.dates) {
        // Store in Neo4j
        await this.session.run(
          `MERGE (e:Entity {name: $name, type: 'Time'})
           WITH e
           MATCH (m:Message {id: $messageId})
           MERGE (m)-[:REFERS_TO]->(e)`,
          { name: date, messageId }
        );
        
        // Note: Knowledge graph now stored exclusively in Neo4j
      }

    } catch (error) {
      console.warn('Failed to extract entities:', error);
    }
  }

  private async extractEntitiesFromText(text: string): Promise<{
    people: string[];
    events: string[];
    dates: string[];
  }> {
    const entities = {
      people: [] as string[],
      events: [] as string[],
      dates: [] as string[]
    };

    // Always extract @mentions as people (guaranteed accurate)
    const mentionMatches = text.match(/@(\w+)/g);
    if (mentionMatches) {
      entities.people = mentionMatches.map(match => match.replace('@', ''));
    }

    // Use OpenAI for intelligent entity extraction
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{
          role: "user",
          content: `Extract entities from this message: "${text}"

Return only a JSON object with these exact keys:
- "locations": places, venues, buildings, cities, addresses (like "downtown", "Marco's Bistro", "Philadelphia")  
- "activities": actions, events, hobbies, plans (like "hiking", "dinner", "meeting", "trip")
- "time_references": dates, times, schedules (like "today", "next week", "Friday")
- "songs": song titles, album names, artist names (like "Midnight Reverie", "The Moonlighters", "Beatles")
- "tv_shows": TV shows, movies, series (like "Galactic Heist Chronicles", "The Office", "Breaking Bad")
- "food_items": specific foods, dishes, ingredients (like "burrito", "hot sauce", "chocolate donut")

Only include entities that are clearly mentioned. Keep song titles and show names in their original case, others lowercase.

Example: {"locations": ["downtown", "restaurant"], "activities": ["hiking", "dinner"], "time_references": ["today"], "songs": ["Midnight Reverie"], "tv_shows": ["Galactic Heist Chronicles"], "food_items": ["burrito", "hot sauce"]}`
        }],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      entities.events = [
        ...(result.locations || []),
        ...(result.activities || []),
        ...(result.songs || []),
        ...(result.tv_shows || []),
        ...(result.food_items || [])
      ];
      entities.dates = result.time_references || [];
      
    } catch (error) {
      console.warn('OpenAI entity extraction failed, using fallback:', error);
      
      // Simple fallback extraction for reliability
      const basicLocationPatterns = /(?:restaurant|cafe|bar|park|beach|downtown|office|home|school|hotel|airport|mall|store|gym|library|museum|theater|club|church|bank|spa|garden|lake|river|city|building|house|apartment|room|kitchen|bedroom|bathroom|garage)/gi;
      const basicActivityPatterns = /(?:hiking|dinner|lunch|meeting|trip|vacation|movie|concert|shopping|birthday|party|celebration|game|class|lesson|training|workshop|presentation|demo|event|show|performance)/gi;
      const basicDatePatterns = /(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|last week|this month|next month|last month|\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
      
      const locationMatches = text.match(basicLocationPatterns);
      const activityMatches = text.match(basicActivityPatterns);
      const dateMatches = text.match(basicDatePatterns);
      
      if (locationMatches) entities.events.push(...locationMatches.map(m => m.toLowerCase()));
      if (activityMatches) entities.events.push(...activityMatches.map(m => m.toLowerCase()));
      if (dateMatches) entities.dates.push(...dateMatches.map(m => m.toLowerCase()));
      
      entities.events = Array.from(new Set(entities.events));
      entities.dates = Array.from(new Set(entities.dates));
    }

    return entities;
  }

  async findMessagesByUser(userName: string, limit: number = 10): Promise<any[]> {
    if (!this.session) return [];

    try {
      const result = await this.session.run(
        `MATCH (u:User {name: $userName})-[:SENT]->(m:Message)
         RETURN m.id as id, m.text as text, m.timestamp as timestamp, m.mentions as mentions
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { userName, limit: Math.floor(limit) }
      );

      return result.records.map(record => ({
        id: record.get('id'),
        text: record.get('text'),
        timestamp: record.get('timestamp'),
        mentions: record.get('mentions')
      }));
    } catch (error) {
      console.warn('Failed to query messages by user:', error);
      return [];
    }
  }

  async findMessagesByTopic(topicName: string, limit: number = 10): Promise<any[]> {
    // Ensure session is active
    if (!this.session) {
      console.log('🔌 No active session, attempting to reconnect...');
      await this.connect();
    }
    
    if (!this.session) {
      console.log('❌ Could not establish Neo4j session');
      return [];
    }

    try {
      console.log(`🔍 Searching for topic: "${topicName}"`);
      
      // Search for topics that contain the search term (case-insensitive)
      const result = await this.session.run(
        `MATCH (topic)
         WHERE topic.name CONTAINS $topicName OR toLower(topic.name) CONTAINS toLower($topicName)
         MATCH (topic)<-[:discusses]-(message)
         RETURN topic.name as topicName, topic.type as topicType, message.content as messageContent, message.timestamp as timestamp
         ORDER BY message.timestamp DESC
         LIMIT $limit`,
        { topicName, limit: Math.floor(limit) }
      );

      console.log(`✅ Found ${result.records.length} records for topic "${topicName}"`);
      
      return result.records.map(record => ({
        topicName: record.get('topicName'),
        topicType: record.get('topicType'),
        messageContent: record.get('messageContent'),
        timestamp: record.get('timestamp')
      }));
    } catch (error) {
      console.warn('Failed to query messages by topic:', error);
      return [];
    }
  }

  async findMessagesByTimeRange(startTime: Date, endTime: Date, limit: number = 10): Promise<any[]> {
    if (!this.session) return [];

    try {
      const result = await this.session.run(
        `MATCH (u:User)-[:SENT]->(m:Message)
         WHERE datetime(m.timestamp) >= datetime($startTime) AND datetime(m.timestamp) <= datetime($endTime)
         RETURN m.id as id, m.text as text, m.timestamp as timestamp, u.name as sender
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { 
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          limit: Math.floor(limit) 
        }
      );

      return result.records.map(record => ({
        id: record.get('id'),
        text: record.get('text'),
        timestamp: record.get('timestamp'),
        sender: record.get('sender')
      }));
    } catch (error) {
      console.warn('Failed to query messages by time range:', error);
      return [];
    }
  }

  async findConversationContext(query: {
    sender?: string;
    topic?: string;
    timeframe?: string;
    limit?: number;
  }): Promise<any[]> {
    if (!this.session) return [];

    try {
      let cypher = `MATCH (u:User)-[:SENT]->(m:Message)`;
      const params: any = { limit: Math.floor(query.limit || 10) };

      const conditions: string[] = [];

      if (query.sender) {
        conditions.push(`u.name = $sender`);
        params.sender = query.sender;
      }

      if (query.topic) {
        cypher += ` MATCH (m)-[:MENTIONS]->(t:Topic)`;
        conditions.push(`t.name = $topic`);
        params.topic = query.topic;
      }

      if (query.timeframe) {
        const timeframeDate = this.parseTimeframe(query.timeframe);
        if (timeframeDate) {
          conditions.push(`datetime(m.timestamp) >= datetime($timeframeDate)`);
          params.timeframeDate = timeframeDate.toISOString();
        }
      }

      if (conditions.length > 0) {
        cypher += ` WHERE ${conditions.join(' AND ')}`;
      }

      cypher += ` RETURN m.id as id, m.text as text, m.timestamp as timestamp, u.name as sender, m.mentions as mentions
                  ORDER BY m.timestamp DESC
                  LIMIT $limit`;

      const result = await this.session.run(cypher, params);

      return result.records.map(record => ({
        id: record.get('id'),
        text: record.get('text'),
        timestamp: record.get('timestamp'),
        sender: record.get('sender'),
        mentions: record.get('mentions')
      }));
    } catch (error) {
      console.warn('Failed to query conversation context:', error);
      return [];
    }
  }

  private parseTimeframe(timeframe: string): Date | null {
    const now = new Date();
    const lowerTimeframe = timeframe.toLowerCase();

    if (lowerTimeframe.includes('last week') || lowerTimeframe.includes('week ago')) {
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (lowerTimeframe.includes('yesterday') || lowerTimeframe.includes('day ago')) {
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (lowerTimeframe.includes('last month') || lowerTimeframe.includes('month ago')) {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (lowerTimeframe.includes('hour ago') || lowerTimeframe.includes('last hour')) {
      return new Date(now.getTime() - 60 * 60 * 1000);
    }

    return null;
  }

  async createOrUpdateRelationship(
    user1Name: string,
    user2Name: string,
    relationshipType: string,
    properties: Record<string, any>
  ): Promise<void> {
    if (!this.session) return;

    try {
      // Create or update relationship between users
      await this.session.run(
        `MATCH (u1:User {name: $user1Name}), (u2:User {name: $user2Name})
         MERGE (u1)-[r:${relationshipType}]->(u2)
         SET r += $properties
         RETURN r`,
        {
          user1Name,
          user2Name,
          properties
        }
      );
      
      // Also create the reverse relationship for bidirectional queries
      await this.session.run(
        `MATCH (u1:User {name: $user1Name}), (u2:User {name: $user2Name})
         MERGE (u2)-[r:${relationshipType}]->(u1)
         SET r += $properties
         RETURN r`,
        {
          user1Name,
          user2Name,
          properties
        }
      );
    } catch (error) {
      console.warn('Failed to create/update relationship:', error);
    }
  }

  async clearAllData(): Promise<void> {
    if (!this.session) {
      console.warn('Neo4j session not available, cannot clear data');
      return;
    }

    try {
      await this.session.run(`
        MATCH (n) 
        DETACH DELETE n
      `);
      console.log('✅ Neo4j data cleared successfully');
    } catch (error) {
      console.error('Failed to clear Neo4j data:', error);
      throw error;
    }
  }

  async extractAndStoreDynamicRelationships(messageContext: MessageContext): Promise<void> {
    console.log('🔗 Starting dynamic relationship extraction for:', messageContext.message.content);
    
    // Skip AI responses to prevent feedback loop
    if (messageContext.message.isAiResponse) {
      console.log('🤖 Skipping dynamic relationship extraction for AI response');
      return;
    }
    
    if (!this.session) {
      console.log('❌ No Neo4j session for dynamic relationships');
      return;
    }

    try {
      const { dynamicRelationshipExtractor } = await import('./dynamicRelationshipExtractor');
      
      // Get recent conversation history for context
      const recentMessages = await this.getRecentMessages(5);
      console.log('📝 Recent messages for context:', recentMessages.length);
      
      const relationships = await dynamicRelationshipExtractor.extractRelationships(
        messageContext.message.content,
        {
          sender: messageContext.sender.name,
          timestamp: messageContext.timestamp,
          conversationHistory: recentMessages
        }
      );

      console.log(`🔗 Extracted ${relationships.length} dynamic relationships, storing in Neo4j`);

      // Store each dynamic relationship in Neo4j
      for (const rel of relationships) {
        if (rel.confidence > 0.6) { // Only store high-confidence relationships
          const safeRelType = rel.relationshipType.replace(/[^A-Z_]/g, '_');
          await this.session.run(
            `MERGE (from:Entity {name: $fromEntity})
             MERGE (to:Entity {name: $toEntity})
             CREATE (from)-[:\`${safeRelType}\` {
               confidence: $confidence,
               context: $context,
               timestamp: $timestamp,
               extractedFrom: $messageId
             }]->(to)`,
            {
              fromEntity: rel.fromEntity,
              toEntity: rel.toEntity,
              confidence: rel.confidence,
              context: rel.context,
              timestamp: rel.timestamp.toISOString(),
              messageId: messageContext.message.id.toString()
            }
          );

          console.log(`✅ Stored relationship: ${rel.fromEntity} --[${rel.relationshipType}]--> ${rel.toEntity} (confidence: ${rel.confidence})`);
        }
      }

    } catch (error) {
      console.warn('❌ Failed to extract/store dynamic relationships:', error);
    }
  }

  private async getRecentMessages(limit: number = 5): Promise<string[]> {
    if (!this.session) return [];

    try {
      const result = await this.session.run(
        `MATCH (m:Message)
         RETURN m.text as text
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { limit }
      );

      return result.records.map(record => record.get('text')).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
    }
    await this.driver.close();
  }
}

export const neo4jService = new Neo4jService();