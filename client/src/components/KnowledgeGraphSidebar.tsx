import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Users, Hash, Calendar, Activity } from "lucide-react";
import { chatApi } from "@/lib/chatApi";

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

  // Debug logging
  console.log("Knowledge Graph Data:", graphData);
  console.log("Conversation Threads:", conversationThreads);
  console.log("Loading:", isLoading);
  console.log("Error:", error);

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
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Knowledge Graph</h3>
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
                <h4 className="text-sm font-medium text-gray-700 mb-3">Entity Relationships</h4>
                <div className="bg-gray-50 rounded-lg p-4 h-48 relative overflow-hidden">
                  {!graphData?.nodes?.length ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      No entities found. Start a conversation with @aiagent to populate the graph.
                    </div>
                  ) : (
                    <>
                      {graphData?.nodes?.slice(0, 5).map((node, index) => (
                        <div
                          key={node.id}
                          className={`absolute w-12 h-12 rounded-full flex items-center justify-center text-white text-xs font-semibold cursor-pointer transition-transform hover:scale-110 ${
                            node.type === "person" ? "bg-blue-500" :
                            node.type === "topic" ? "bg-purple-500" :
                            node.type === "event" ? "bg-green-500" :
                            "bg-gray-500"
                          }`}
                          style={{
                            left: `${20 + (index * 30)}px`,
                            top: `${20 + (index % 3) * 40}px`,
                          }}
                          title={node.name}
                        >
                          {node.type === "person" 
                            ? node.name.split(" ").map(n => n[0]).join("").toUpperCase()
                            : node.name.slice(0, 2).toUpperCase()
                          }
                        </div>
                      ))}
                      
                      {/* Connection lines */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {graphData?.relationships?.slice(0, 3).map((rel, index) => (
                          <line
                            key={rel.id}
                            x1={50 + (index * 30)}
                            y1={50 + (index % 3) * 40}
                            x2={80 + (index * 30)}
                            y2={80 + ((index + 1) % 3) * 40}
                            stroke="#6B7280"
                            strokeWidth="2"
                            strokeDasharray="5,5"
                          />
                        ))}
                      </svg>
                    </>
                  )}
                </div>
              </div>

              {/* Entity List */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Entities</h4>
                <div className="space-y-2">
                  {graphData?.entitySummaries?.slice(0, 10).map((entity, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                    >
                      <div className={getEntityColor(entity.type)}>
                        {getEntityIcon(entity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{entity.name}</div>
                        <div className="text-xs text-gray-500">
                          {entity.mentions} mentions • {formatDate(entity.lastMentioned)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="relationships" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Entity Relationships</h4>
                <div className="space-y-2">
                  {graphData?.relationships?.slice(0, 10).map((rel) => (
                    <div
                      key={rel.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="text-sm font-medium">{rel.type}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {graphData.nodes.find(n => n.id === rel.from)?.name} → {graphData.nodes.find(n => n.id === rel.to)?.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="threads" className="space-y-4 mt-0">
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Conversation Threads</h4>
                <div className="space-y-2">
                  {conversationThreads?.slice(0, 10).map((thread) => (
                    <div
                      key={thread.id}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="text-sm font-medium">{thread.topic}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {thread.participants.join(" → ")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {thread.messageCount} messages • {formatDate(thread.lastMessageAt)}
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
