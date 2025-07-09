import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Hash, Calendar, Activity, ZoomIn, ZoomOut } from "lucide-react";
import { chatApi } from "@/lib/chatApi";
import { Link } from "wouter";

// Full-screen Network Graph Component
function FullScreenNetworkGraph({ nodes, relationships }) {
  const [zoom, setZoom] = useState(1);
  const containerWidth = window.innerWidth - 100;
  const containerHeight = window.innerHeight - 200;
  
  // Create a better distributed layout with forced spacing
  const nodePositions = nodes.map((node, index) => {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    const paddingX = 150;
    const paddingY = 100;
    const minSpacing = 120; // Minimum space between nodes
    
    const availableWidth = containerWidth - 2 * paddingX;
    const availableHeight = containerHeight - 2 * paddingY;
    
    // Calculate positions with minimum spacing
    const cellWidth = Math.max(minSpacing, availableWidth / cols);
    const cellHeight = Math.max(minSpacing, availableHeight / rows);
    
    const x = paddingX + col * cellWidth + cellWidth / 2;
    const y = paddingY + row * cellHeight + cellHeight / 2;
    
    return {
      ...node,
      x: Math.max(100, Math.min(containerWidth - 100, x)),
      y: Math.max(80, Math.min(containerHeight - 80, y))
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
    return Math.max(20, Math.min(40, 20 + connections * 2));
  };
  
  return (
    <div className="relative w-full h-full bg-gray-50 rounded-lg overflow-hidden">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom(Math.min(2, zoom + 0.25))}
          disabled={zoom >= 2}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <span className="px-2 py-1 bg-white rounded text-sm border">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      <svg 
        width={containerWidth} 
        height={containerHeight} 
        className="absolute inset-0"
        style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}
      >
        {/* Render edges first */}
        {connections.map((connection, index) => (
          <g key={index}>
            <line
              x1={connection.from.x}
              y1={connection.from.y}
              x2={connection.to.x}
              y2={connection.to.y}
              stroke="#E5E7EB"
              strokeWidth="3"
              opacity="0.7"
            />
            {/* Edge label - only show for reasonable distances */}
            {Math.sqrt(Math.pow(connection.from.x - connection.to.x, 2) + Math.pow(connection.from.y - connection.to.y, 2)) > 80 && (
              <text
                x={(connection.from.x + connection.to.x) / 2}
                y={(connection.from.y + connection.to.y) / 2}
                textAnchor="middle"
                fontSize="11"
                fill="#6B7280"
                className="pointer-events-none"
                dy="-3"
              >
                {connection.type}
              </text>
            )}
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
                strokeWidth="3"
                className="cursor-pointer hover:opacity-80"
              />
              
              {/* Node label with background for better visibility */}
              <rect
                x={node.x - (node.name.length * 4)}
                y={node.y - nodeSize - 30}
                width={node.name.length * 8}
                height="18"
                fill="white"
                fillOpacity="0.9"
                stroke="#E5E7EB"
                strokeWidth="1"
                rx="3"
              />
              <text
                x={node.x}
                y={node.y - nodeSize - 18}
                textAnchor="middle"
                fontSize="13"
                fontWeight="600"
                fill="#374151"
                className="pointer-events-none"
              >
                {node.name}
              </text>
              
              {/* Node type indicator */}
              <text
                x={node.x}
                y={node.y + 6}
                textAnchor="middle"
                fontSize="12"
                fill="white"
                className="pointer-events-none font-medium"
              >
                {node.type === "person" ? "P" : 
                 node.type === "topic" ? "T" : 
                 node.type === "event" ? "E" : "D"}
              </text>

              {/* Connection count with background */}
              <rect
                x={node.x - 25}
                y={node.y + nodeSize + 8}
                width="50"
                height="14"
                fill="white"
                fillOpacity="0.8"
                stroke="#E5E7EB"
                strokeWidth="1"
                rx="2"
              />
              <text
                x={node.x}
                y={node.y + nodeSize + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#6B7280"
                className="pointer-events-none"
              >
                {node.connections} connections
              </text>
            </g>
          );
        })}
        
        {/* Legend */}
        <g transform="translate(40, 40)">
          <rect width="180" height="120" fill="white" fillOpacity="0.95" stroke="#E5E7EB" strokeWidth="2" rx="8" />
          <text x="10" y="25" fontSize="16" fontWeight="600" fill="#374151">Legend</text>
          <circle cx="20" cy="45" r="8" fill="#3B82F6" />
          <text x="35" y="50" fontSize="14" fill="#374151">Person</text>
          <circle cx="20" cy="70" r="8" fill="#8B5CF6" />
          <text x="35" y="75" fontSize="14" fill="#374151">Topic</text>
          <circle cx="20" cy="95" r="8" fill="#10B981" />
          <text x="35" y="100" fontSize="14" fill="#374151">Event</text>
          <circle cx="100" cy="45" r="8" fill="#F59E0B" />
          <text x="115" y="50" fontSize="14" fill="#374151">Date</text>
          <text x="10" y="120" fontSize="12" fill="#6B7280">Size = Connection Count</text>
        </g>
      </svg>
    </div>
  );
}

export default function KnowledgeGraphFullView() {
  const [activeTab, setActiveTab] = useState("graph");

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
        return <Users className="h-5 w-5" />;
      case "topic":
        return <Hash className="h-5 w-5" />;
      case "event":
        return <Calendar className="h-5 w-5" />;
      case "date":
        return <Calendar className="h-5 w-5" />;
      default:
        return <Activity className="h-5 w-5" />;
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 text-lg">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Chat
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Knowledge Graph - Full View</h1>
          </div>
          <div className="text-sm text-gray-500">
            {graphData?.nodes?.length || 0} entities • {graphData?.relationships?.length || 0} relationships
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="graph">Network Graph</TabsTrigger>
            <TabsTrigger value="entities">Entities</TabsTrigger>
            <TabsTrigger value="relationships">Relations</TabsTrigger>
          </TabsList>

          <TabsContent value="graph" className="mt-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div style={{ height: 'calc(100vh - 280px)' }}>
                {!graphData?.nodes?.length ? (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    No entities found. Start a conversation with @aiagent to populate the graph.
                  </div>
                ) : (
                  <FullScreenNetworkGraph 
                    nodes={graphData.nodes} 
                    relationships={graphData.relationships} 
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="entities" className="mt-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">All Entities ({graphData?.nodes?.length || 0})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {graphData?.entitySummaries?.map((entity, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className={getEntityColor(entity.type)}>
                      {getEntityIcon(entity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{entity.name}</div>
                      <div className="text-sm text-gray-500">
                        {entity.mentions} mentions • {formatDate(entity.lastMentioned)}
                      </div>
                      {entity.relatedEntities?.length > 0 && (
                        <div className="text-sm text-gray-400 mt-1">
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

          <TabsContent value="relationships" className="mt-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">All Relationships ({graphData?.relationships?.length || 0})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {graphData?.relationships?.map((rel) => (
                  <div
                    key={rel.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="font-medium capitalize text-gray-900">{rel.type}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">{graphData.nodes.find(n => n.id === rel.from)?.name}</span> → <span className="font-medium">{graphData.nodes.find(n => n.id === rel.to)?.name}</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {graphData.nodes.find(n => n.id === rel.from)?.type} connects to {graphData.nodes.find(n => n.id === rel.to)?.type}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}