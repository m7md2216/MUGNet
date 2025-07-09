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
    // Use a local Neo4j instance or configure based on environment
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';
    
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
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
    if (!this.session) return;

    const indexes = [
      'CREATE INDEX IF NOT EXISTS FOR (u:User) ON (u.id)',
      'CREATE INDEX IF NOT EXISTS FOR (m:Message) ON (m.id)',
      'CREATE INDEX IF NOT EXISTS FOR (t:Topic) ON (t.name)',
      'CREATE INDEX IF NOT EXISTS FOR (e:Entity) ON (e.name)',
      'CREATE INDEX IF NOT EXISTS FOR (th:Thread) ON (th.topic)'
    ];

    for (const index of indexes) {
      try {
        await this.session.run(index);
      } catch (error) {
        console.warn('Failed to create index:', error);
      }
    }
  }

  async syncUser(user: User): Promise<void> {
    if (!this.session) return;

    try {
      await this.session.run(
        `MERGE (u:User {id: $id})
         SET u.name = $name, u.initials = $initials, u.color = $color, u.lastActiveAt = $lastActiveAt`,
        {
          id: user.id.toString(),
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
         SET m.content = $content, m.timestamp = $timestamp, m.mentions = $mentions`,
        {
          id: message.id.toString(),
          content: message.content,
          timestamp: message.timestamp.toISOString(),
          mentions: message.mentions
        }
      );

      // Create sender relationship
      await this.session.run(
        `MATCH (u:User {id: $senderId}), (m:Message {id: $messageId})
         MERGE (u)-[:SENT]->(m)`,
        {
          senderId: sender.id.toString(),
          messageId: message.id.toString()
        }
      );

      // Create recipient relationships
      for (const recipient of recipients) {
        await this.session.run(
          `MATCH (u:User {id: $recipientId}), (m:Message {id: $messageId})
           MERGE (m)-[:TO]->(u)`,
          {
            recipientId: recipient.id.toString(),
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
    } catch (error) {
      console.warn('Failed to sync message to Neo4j:', error);
    }
  }

  async findMessagesByUser(userName: string, limit: number = 10): Promise<any[]> {
    if (!this.session) return [];

    try {
      const result = await this.session.run(
        `MATCH (u:User {name: $userName})-[:SENT]->(m:Message)
         RETURN m.id as id, m.content as content, m.timestamp as timestamp, m.mentions as mentions
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { userName, limit }
      );

      return result.records.map(record => ({
        id: record.get('id'),
        content: record.get('content'),
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
         RETURN m.id as id, m.content as content, m.timestamp as timestamp, u.name as sender
         ORDER BY m.timestamp DESC
         LIMIT $limit`,
        { topicName, limit }
      );

      return result.records.map(record => ({
        id: record.get('id'),
        content: record.get('content'),
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
         RETURN m.id as id, m.content as content, m.timestamp as timestamp, u.name as sender
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
        content: record.get('content'),
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
      const params: any = { limit: query.limit || 10 };

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

      cypher += ` RETURN m.id as id, m.content as content, m.timestamp as timestamp, u.name as sender, m.mentions as mentions
                  ORDER BY m.timestamp DESC
                  LIMIT $limit`;

      const result = await this.session.run(cypher, params);

      return result.records.map(record => ({
        id: record.get('id'),
        content: record.get('content'),
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