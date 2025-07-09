import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Users, Hash, Calendar, Activity, ExternalLink } from "lucide-react";
import { chatApi } from "@/lib/chatApi";
import { Link } from "wouter";

// List-based Graph Component for cleaner display
function NetworkGraph({ nodes, relationships }) {
  const getNodeColor = (type) => {
    switch (type) {
      case 'person': return '#3B82F6';
      case 'topic': return '#8B5CF6';
      case 'event': return '#10B981';
      case 'date': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'person': return 'P';
      case 'topic': return 'T';
      case 'event': return 'E';
      case 'date': return 'D';
      default: return '?';
    }
  };

  return (
    <div className="p-4 space-y-4 bg-white">
      {/* Node List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Entities</h4>
        <div className="grid grid-cols-2 gap-2">
          {nodes.map((node, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: getNodeColor(node.type) }}
              >
                {getTypeIcon(node.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {node.name}
                </div>
                <div className="text-xs text-gray-500">
                  {node.connections} connections
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Relationships */}
      {relationships.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Relationships</h4>
          <div className="space-y-1">
            {relationships.slice(0, 3).map((rel, index) => {
              const fromNode = nodes.find(n => n.id === rel.from);
              const toNode = nodes.find(n => n.id === rel.to);
              
              if (!fromNode || !toNode) return null;
              
              return (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded text-xs">
                  <span className="font-medium text-gray-900">{fromNode.name}</span>
                  <span className="text-gray-500">→</span>
                  <span className="font-medium text-gray-900">{toNode.name}</span>
                  <span className="text-gray-500 ml-auto">{rel.type}</span>
                </div>
              );
            })}
            {relationships.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{relationships.length - 3} more relationships
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface KnowledgeGraphSidebarProps {
  onClose: () => void;
}

export function KnowledgeGraphSidebar({ onClose }: KnowledgeGraphSidebarProps) {
  const [activeTab, setActiveTab] = useState("entities");

  const { data: graphData, isLoading, error } = useQuery({
    queryKey: ["/api/knowledge-graph"],
    queryFn: chatApi.getKnowledgeGraph,
  });

  const { data: conversationThreads = [] } = useQuery({
    queryKey: ["/api/conversation-threads"],
    queryFn: chatApi.getConversationThreads,
  });



  const getEntityIcon = (type: string) => {
    switch (type) {
      case "person":
        return <Users className="h-4 w-4" />;
      case "topic":
        return <Hash className="h-4 w-4" />;
      case "event":
        return <Calendar className="h-4 w-4" />;
      case "date":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEntityColor = (type: string) => {
    switch (type) {
      case "person":
        return "text-blue-500";
      case "topic":
        return "text-purple-500";
      case "event":
        return "text-green-500";
      case "date":
        return "text-orange-500";
      default:
        return "text-gray-500";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
          <p className="text-gray-500">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[500px] bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Knowledge Graph</h3>
          <div className="flex gap-2">
            <Link href="/knowledge-graph">
              <Button
                variant="outline"
                size="sm"
                className="text-gray-600 hover:text-gray-800"
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Full View
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 m-4 mb-2">
            <TabsTrigger value="entities">Entities</TabsTrigger>
            <TabsTrigger value="relationships">Relations</TabsTrigger>
            <TabsTrigger value="threads">Threads</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <TabsContent value="entities" className="space-y-4 mt-0">
              {/* Graph Visualization */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Entity Network</h4>
                <div className="bg-gray-50 rounded-lg">
                  {!graphData?.nodes?.length ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                      No entities found. Start a conversation with @aiagent to populate the graph.
                    </div>
                  ) : (
                    <NetworkGraph 
                      nodes={graphData.nodes.slice(0, 6)} 
                      relationships={graphData.relationships.slice(0, 6)} 
                    />
                  )}
                </div>
              </div>

              {/* Entity List */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">All Entities ({graphData?.nodes?.length || 0})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {graphData?.entitySummaries?.map((entity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className={getEntityColor(entity.type)}>
                        {getEntityIcon(entity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{entity.name}</div>
                        <div className="text-xs text-gray-500">
                          {entity.mentions} mentions • {formatDate(entity.lastMentioned)}
                        </div>
                        {entity.relatedEntities?.length > 0 && (
                          <div className="text-xs text-gray-400 mt-1">
                            Connected to: {entity.relatedEntities.slice(0, 3).join(', ')}
                            {entity.relatedEntities.length > 3 && ` +${entity.relatedEntities.length - 3} more`}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="relationships" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Entity Relationships ({graphData?.relationships?.length || 0})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {graphData?.relationships?.map((rel) => (
                    <div
                      key={rel.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-sm font-medium capitalize">{rel.type}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        <span className="font-medium">{graphData.nodes.find(n => n.id === rel.from)?.name}</span> → <span className="font-medium">{graphData.nodes.find(n => n.id === rel.to)?.name}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {graphData.nodes.find(n => n.id === rel.from)?.type} connects to {graphData.nodes.find(n => n.id === rel.to)?.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="threads" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Conversation Threads ({conversationThreads?.length || 0})</h4>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {conversationThreads?.map((thread) => (
                    <div
                      key={thread.id}
                      className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-sm font-medium">{thread.topic}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Participants: {thread.participants.join(", ")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {thread.messageCount} messages • Last: {formatDate(thread.lastMessageAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
