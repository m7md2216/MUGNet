import React from 'react';
import { X, Database, ExternalLink, Code } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface KnowledgeGraphSidebarProps {
  onClose: () => void;
}

export function KnowledgeGraphSidebar({ onClose }: KnowledgeGraphSidebarProps) {
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-lg z-50 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Neo4j Browser Access</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="w-4 h-4" />
              Developer Graph Interface
            </CardTitle>
            <CardDescription>
              Access the conversation knowledge graph through Neo4j Browser for advanced querying and visualization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Connection Details:</h4>
              <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm font-mono">
                <div>URI: neo4j://localhost:7687</div>
                <div>Username: neo4j</div>
                <div>Password: neo4j</div>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Code className="w-4 h-4" />
              Sample Queries
            </CardTitle>
            <CardDescription>
              Pre-built Cypher queries to explore the conversation graph.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <h5 className="text-sm font-medium mb-2">View Recent Conversations:</h5>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono whitespace-pre-wrap">
{`MATCH (u:User)-[:SENT]->(m:Message)
OPTIONAL MATCH (m)-[:TO]->(r:User)
OPTIONAL MATCH (m)-[:MENTIONS]->(t:Topic)
OPTIONAL MATCH (m)-[:CONTAINS_ENTITY]->(e:Entity)
RETURN u, m, r, t, e
ORDER BY m.timestamp DESC
LIMIT 100`}
                </div>
              </div>

              <Separator />

              <div>
                <h5 className="text-sm font-medium mb-2">Messages by Topic:</h5>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono whitespace-pre-wrap">
{`MATCH (m:Message)-[:MENTIONS]->(t:Topic {name: "Tesla"})
OPTIONAL MATCH (m)<-[:SENT]-(u:User)
OPTIONAL MATCH (m)-[:TO]->(r:User)
RETURN u, m, r, t
ORDER BY m.timestamp DESC`}
                </div>
              </div>

              <Separator />

              <div>
                <h5 className="text-sm font-medium mb-2">Entity Relationships:</h5>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono whitespace-pre-wrap">
{`MATCH (e:Entity)
OPTIONAL MATCH (e)<-[:CONTAINS_ENTITY]-(m:Message)
OPTIONAL MATCH (m)<-[:SENT]-(u:User)
RETURN e, m, u
ORDER BY e.type, e.name`}
                </div>
              </div>

              <Separator />

              <div>
                <h5 className="text-sm font-medium mb-2">Full Graph Overview:</h5>
                <div className="bg-gray-900 text-green-400 p-3 rounded text-xs font-mono whitespace-pre-wrap">
{`MATCH (n)
OPTIONAL MATCH (n)-[r]->(m)
RETURN n, r, m
LIMIT 500`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schema Overview</CardTitle>
            <CardDescription>
              Node types and relationships in the conversation graph.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div>
                <h5 className="font-medium">Node Types:</h5>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                  <li>:User (name, initials, color)</li>
                  <li>:Message (text, timestamp, mentions)</li>
                  <li>:Topic (name)</li>
                  <li>:Entity (name, type)</li>
                </ul>
              </div>
              <div>
                <h5 className="font-medium">Relationships:</h5>
                <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
                  <li>(:User)-[:SENT]→(:Message)</li>
                  <li>(:Message)-[:TO]→(:User)</li>
                  <li>(:Message)-[:MENTIONS]→(:Topic)</li>
                  <li>(:Message)-[:CONTAINS_ENTITY]→(:Entity)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}