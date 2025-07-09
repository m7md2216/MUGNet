import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Users, Hash, Calendar, Activity } from "lucide-react";
import { chatApi } from "@/lib/chatApi";

// Network Graph Component
function NetworkGraph({ nodes, relationships }) {
  const containerWidth = 350;
  const containerHeight = 240;
  
  // Create a simpler circular layout for nodes
  const nodePositions = nodes.map((node, index) => {
    const angle = (index * 2 * Math.PI) / nodes.length;
    const radius = Math.min(containerWidth, containerHeight) * 0.3;
    const centerX = containerWidth / 2;
    const centerY = containerHeight / 2;
    
    return {
      ...node,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  });
  
  // Find connections for each node
  const connections = relationships.map(rel => {
    const fromNode = nodePositions.find(n => n.id === rel.from);
    const toNode = nodePositions.find(n => n.id === rel.to);
    return fromNode && toNode ? { from: fromNode, to: toNode, type: rel.type } : null;
  }).filter(Boolean);
  
  const getNodeColor = (type) => {
    switch (type) {
      case "person": return "#3B82F6";
      case "topic": return "#8B5CF6";
      case "event": return "#10B981";
      case "date": return "#F59E0B";
      default: return "#6B7280";
    }
  };
  
  const getNodeSize = (connections) => {
    return Math.max(8, Math.min(20, 8 + connections * 2));
  };
  
  return (
    <svg width={containerWidth} height={containerHeight} className="absolute inset-0">
      {/* Render edges first (so they appear behind nodes) */}
      {connections.map((connection, index) => (
        <g key={index}>
          <line
            x1={connection.from.x}
            y1={connection.from.y}
            x2={connection.to.x}
            y2={connection.to.y}
            stroke="#E5E7EB"
            strokeWidth="2"
            opacity="0.7"
          />
          {/* Edge label */}
          <text
            x={(connection.from.x + connection.to.x) / 2}
            y={(connection.from.y + connection.to.y) / 2}
            textAnchor="middle"
            fontSize="10"
            fill="#6B7280"
            className="pointer-events-none"
          >
            {connection.type}
          </text>
        </g>
      ))}
      
      {/* Render nodes */}
      {nodePositions.map((node, index) => {
        const nodeSize = getNodeSize(node.connections);
        const nodeColor = getNodeColor(node.type);
        
        return (
          <g key={node.id}>
            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={nodeSize}
              fill={nodeColor}
              stroke="white"
              strokeWidth="2"
              className="cursor-pointer hover:opacity-80"
            />
            
            {/* Node label */}
            <text
              x={node.x}
              y={node.y - nodeSize - 5}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#374151"
              className="pointer-events-none"
            >
              {node.name.length > 8 ? `${node.name.substring(0, 8)}...` : node.name}
            </text>
            
            {/* Node type indicator */}
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              fontSize="8"
              fill="white"
              className="pointer-events-none font-medium"
            >
              {node.type === "person" ? "P" : 
               node.type === "topic" ? "T" : 
               node.type === "event" ? "E" : "D"}
            </text>
          </g>
        );
      })}
      
      {/* Legend */}
      <g transform="translate(10, 10)">
        <rect width="100" height="60" fill="white" fillOpacity="0.9" stroke="#E5E7EB" rx="4" />
        <text x="5" y="15" fontSize="10" fontWeight="600" fill="#374151">Legend</text>
        <circle cx="10" cy="25" r="4" fill="#3B82F6" />
        <text x="18" y="28" fontSize="9" fill="#374151">Person</text>
        <circle cx="10" cy="38" r="4" fill="#8B5CF6" />
        <text x="18" y="41" fontSize="9" fill="#374151">Topic</text>
        <circle cx="10" cy="51" r="4" fill="#10B981" />
        <text x="18" y="54" fontSize="9" fill="#374151">Event</text>
      </g>
    </svg>
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
                <h4 className="text-sm font-medium text-gray-700 mb-3">Entity Network</h4>
                <div className="bg-gray-50 rounded-lg p-4 h-64 relative overflow-hidden">
                  {!graphData?.nodes?.length ? (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      No entities found. Start a conversation with @aiagent to populate the graph.
                    </div>
                  ) : (
                    <NetworkGraph 
                      nodes={graphData.nodes.slice(0, 8)} 
                      relationships={graphData.relationships.slice(0, 12)} 
                    />
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
