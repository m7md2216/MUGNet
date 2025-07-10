import React from 'react';
import { Database, ExternalLink, Code, ArrowLeft, Copy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';

export default function KnowledgeGraphFullView() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const sampleQueries = [
    {
      title: "View Recent Conversation Graph",
      description: "Shows the complete recent conversation network with all relationships",
      query: `MATCH (u:User)-[:SENT]->(m:Message)
OPTIONAL MATCH (m)-[:TO]->(r:User)
OPTIONAL MATCH (m)-[:MENTIONS]->(t:Topic)
OPTIONAL MATCH (m)-[:REPLIED_TO]->(prev:Message)
OPTIONAL MATCH (m)-[:CONTAINS_ENTITY]->(e:Entity)
RETURN u, m, r, t, prev, e
ORDER BY m.timestamp DESC
LIMIT 100`
    },
    {
      title: "Messages About Specific Topic",
      description: "Find all messages mentioning a specific topic (replace 'Tesla' with your topic)",
      query: `MATCH (m:Message)-[:MENTIONS]->(t:Topic {name: "Tesla"})
OPTIONAL MATCH (m)<-[:SENT]-(u:User)
OPTIONAL MATCH (m)-[:TO]->(r:User)
RETURN u, m, r, t
ORDER BY m.timestamp DESC`
    },
    {
      title: "User Conversation History",
      description: "View all messages from a specific user with context",
      query: `MATCH (u:User {name: "Alice"})-[:SENT]->(m:Message)
OPTIONAL MATCH (m)-[:TO]->(recipient:User)
OPTIONAL MATCH (m)-[:MENTIONS]->(t:Topic)
OPTIONAL MATCH (m)-[:CONTAINS_ENTITY]->(e:Entity)
RETURN u, m, recipient, t, e
ORDER BY m.timestamp DESC`
    },
    {
      title: "Entity Relationship Network",
      description: "Explore entities and their connections through messages",
      query: `MATCH (e:Entity)
OPTIONAL MATCH (e)<-[:CONTAINS_ENTITY]-(m:Message)<-[:SENT]-(u:User)
OPTIONAL MATCH (m)-[:TO]->(recipient:User)
RETURN e, m, u, recipient
ORDER BY e.type, e.name`
    },
    {
      title: "Conversation Threads",
      description: "Find message reply chains and conversation threads",
      query: `MATCH path = (start:Message)-[:REPLIED_TO*]->(end:Message)
MATCH (start)<-[:SENT]-(startUser:User)
MATCH (end)<-[:SENT]-(endUser:User)
RETURN path, startUser, endUser
ORDER BY start.timestamp DESC`
    },
    {
      title: "Complete Graph Overview",
      description: "View the entire knowledge graph structure",
      query: `MATCH (n)
OPTIONAL MATCH (n)-[r]->(m)
WHERE labels(n) IN ['User', 'Message', 'Topic', 'Entity']
RETURN n, r, m
LIMIT 500`
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Chat
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              Neo4j Browser Interface
            </h1>
            <p className="text-gray-600 mt-1">
              Developer access to the conversation knowledge graph
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Connection Info */}
          <div className="lg:col-span-1">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Connection Setup
                </CardTitle>
                <CardDescription>
                  Configure Neo4j connection for development access
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Local Development:</h4>
                  <div className="bg-gray-100 p-3 rounded-lg space-y-1 text-sm font-mono">
                    <div>URI: neo4j://localhost:7687</div>
                    <div>Username: neo4j</div>
                    <div>Password: neo4j</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Neo4j Aura Cloud:</h4>
                  <div className="bg-gray-100 p-3 rounded-lg space-y-1 text-sm font-mono">
                    <div>URI: neo4j+s://&lt;id&gt;.databases.neo4j.io</div>
                    <div>Username: neo4j</div>
                    <div>Password: &lt;your-password&gt;</div>
                  </div>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={() => window.open('http://localhost:7474', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Neo4j Browser
                </Button>
              </CardContent>
            </Card>

            {/* Schema Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Graph Schema</CardTitle>
                <CardDescription>
                  Data model and relationships
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      Node Types
                      <Badge variant="secondary" className="text-xs">4 types</Badge>
                    </h5>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span className="font-mono">:User</span>
                        <span className="text-gray-500 text-xs">(name, initials, color)</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="font-mono">:Message</span>
                        <span className="text-gray-500 text-xs">(text, timestamp, mentions)</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                        <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                        <span className="font-mono">:Topic</span>
                        <span className="text-gray-500 text-xs">(name)</span>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-orange-50 rounded">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="font-mono">:Entity</span>
                        <span className="text-gray-500 text-xs">(name, type)</span>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      Relationships
                      <Badge variant="secondary" className="text-xs">4 types</Badge>
                    </h5>
                    <div className="space-y-1 font-mono text-xs">
                      <div>(:User)-[:SENT]→(:Message)</div>
                      <div>(:Message)-[:TO]→(:User)</div>
                      <div>(:Message)-[:MENTIONS]→(:Topic)</div>
                      <div>(:Message)-[:CONTAINS_ENTITY]→(:Entity)</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sample Queries */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Code className="w-5 h-5" />
                <h2 className="text-xl font-semibold">Sample Cypher Queries</h2>
              </div>

              {sampleQueries.map((query, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{query.title}</CardTitle>
                        <CardDescription>{query.description}</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(query.query)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                      {query.query}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>
              How to use Neo4j Browser with the conversation graph
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-2">1. Start Neo4j Database</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Install Neo4j Desktop or use Neo4j Aura</li>
                  <li>• Create a new database or use existing</li>
                  <li>• Start the database instance</li>
                  <li>• Note the connection URI and credentials</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">2. Configure Environment</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Set NEO4J_URI environment variable</li>
                  <li>• Set NEO4J_USERNAME and NEO4J_PASSWORD</li>
                  <li>• Restart the application</li>
                  <li>• Verify connection in server logs</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">3. Access Neo4j Browser</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Open http://localhost:7474 in browser</li>
                  <li>• Enter connection credentials</li>
                  <li>• Run sample queries above</li>
                  <li>• Explore the conversation graph visually</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">4. Analyze Conversations</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Use graph visualization for patterns</li>
                  <li>• Query specific users or topics</li>
                  <li>• Export data for external analysis</li>
                  <li>• Build custom queries for insights</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}