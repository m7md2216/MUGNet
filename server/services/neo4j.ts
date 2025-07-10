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
  private session: Session | null = null;

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

      // Add entity extraction for comprehensive knowledge graph
      await this.extractAndStoreEntities(message.content, message.id.toString());
      
    } catch (error) {
      console.warn('Failed to sync message to Neo4j:', error);
    }
  }

  private async extractAndStoreEntities(content: string, messageId: string): Promise<void> {
    if (!this.session) return;

    try {
      const entities = this.extractEntitiesFromText(content);
      
      // Store People entities
      for (const person of entities.people) {
        await this.session.run(
          `MERGE (e:Entity {name: $name, type: 'Person'})
           WITH e
           MATCH (m:Message {id: $messageId})
           MERGE (m)-[:CONTAINS_ENTITY]->(e)`,
          { name: person, messageId }
        );
      }

      // Store Events entities
      for (const event of entities.events) {
        await this.session.run(
          `MERGE (e:Entity {name: $name, type: 'Event'})
           WITH e
           MATCH (m:Message {id: $messageId})
           MERGE (m)-[:CONTAINS_ENTITY]->(e)`,
          { name: event, messageId }
        );
      }

      // Store Date entities
      for (const date of entities.dates) {
        await this.session.run(
          `MERGE (e:Entity {name: $name, type: 'Date'})
           WITH e
           MATCH (m:Message {id: $messageId})
           MERGE (m)-[:CONTAINS_ENTITY]->(e)`,
          { name: date, messageId }
        );
      }

    } catch (error) {
      console.warn('Failed to extract entities:', error);
    }
  }

  private extractEntitiesFromText(text: string): {
    people: string[];
    events: string[];
    dates: string[];
  } {
    const entities = {
      people: [] as string[],
      events: [] as string[],
      dates: [] as string[]
    };

    // Extract people (proper names and @mentions)
    const peopleMatches = text.match(/@(\w+)|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (peopleMatches) {
      entities.people = peopleMatches.map(match => match.replace('@', ''));
    }

    // Extract events (patterns like "meeting", "conference", "dinner")
    const eventPatterns = /(?:meeting|conference|dinner|lunch|party|event|celebration|trip|vacation|wedding|birthday|anniversary|presentation|demo|launch|release)/gi;
    const eventMatches = text.match(eventPatterns);
    if (eventMatches) {
      entities.events = [...new Set(eventMatches.map(match => match.toLowerCase()))];
    }

    // Extract dates (various formats)
    const datePatterns = /(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4})/gi;
    const dateMatches = text.match(datePatterns);
    if (dateMatches) {
      entities.dates = [...new Set(dateMatches.map(match => match.toLowerCase()))];
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
        { userName, limit }
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
    if (!this.session) return [];

    try {
      const result = await this.session.run(
        `MATCH (t:Topic {name: $topicName})<-[:MENTIONS]-(m:Message)<-[:SENT]-(u:User)
         RETURN m.id as id, m.text as text, m.timestamp as timestamp, u.name as sender
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { topicName, limit }
      );

      return result.records.map(record => ({
        id: record.get('id'),
        text: record.get('text'),
        timestamp: record.get('timestamp'),
        sender: record.get('sender')
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
          limit 
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

  async close(): Promise<void> {
    if (this.session) {
      await this.session.close();
    }
    await this.driver.close();
  }
}

export const neo4jService = new Neo4jService();