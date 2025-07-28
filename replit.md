# AI Chat Application - Replit Documentation

## Overview

This is a full-stack AI chat application built with React frontend and Express backend. The application features an intelligent chat system with knowledge graph capabilities, user management, and AI-powered responses with entity extraction.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with custom CSS variables
- **State Management**: React Query (@tanstack/react-query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Database**: PostgreSQL using Neon Database (@neondatabase/serverless)
- **ORM**: Drizzle ORM with TypeScript schema definitions
- **AI Integration**: OpenAI API for chat responses and entity extraction
- **Session Management**: Built-in session handling for user activity
- **Storage**: Using DatabaseStorage with PostgreSQL for persistent data storage

### Recent Changes (July 10, 2025)
- **Deprecated React Graph Visualization**: Removed custom frontend graph components in favor of direct Neo4j Browser access
- **Neo4j Browser Integration**: Replaced React-based visualization with professional Neo4j Browser interface for developers
- **Enhanced Neo4j Service**: Updated Neo4j schema with proper entity extraction and comprehensive relationship mapping
- **Developer Documentation**: Created comprehensive Neo4j Browser guide with sample Cypher queries and setup instructions
- **Simplified Sidebar**: Knowledge graph sidebar now provides Neo4j Browser access instead of custom visualization
- **Professional Graph Analysis**: Developers can now use Neo4j's powerful query engine and visualization tools directly
- **Sample Query Library**: Pre-built Cypher queries for common conversation analysis patterns
- **Schema Documentation**: Complete graph schema with node types and relationship definitions
- **Connection Management**: Proper Neo4j connection handling with fallback for development environments

### System Simplification (July 14, 2025 - 7:37 PM)
- **Removed LangChain and LangGraph**: Eliminated complex, redundant AI orchestration layers
- **Simplified AI Service**: Replaced with direct OpenAI integration using GPT-4o
- **Streamlined Architecture**: Now uses PostgreSQL + Neo4j + Direct OpenAI calls
- **Maintained Neo4j Integration**: AI still leverages knowledge graph for context-aware responses
- **Reduced Dependencies**: Removed 23 Python packages including langchain, langgraph, and dependencies
- **Improved Performance**: Direct OpenAI calls are faster and more reliable
- **Cleaner Codebase**: Removed 3 complex service files (langchain.ts, langgraph.ts, openai.ts)

### Real-time Relationship Inference (July 15, 2025 - 8:42 PM)
- **New Feature**: Added GPT-4o powered relationship inference service
- **Service Location**: `server/services/relationshipInference.ts`
- **Integration**: Automatically processes every message with mentions in POST /api/messages
- **AI-Powered**: Uses few-shot prompting to infer relationships (FRIENDS_WITH, WORKS_WITH, FAMILY, UNKNOWN)
- **Neo4j Storage**: Stores inferred relationships as bidirectional edges between User nodes
- **Performance**: Processes messages in 0.9-3.7 seconds with OpenAI API calls
- **Context-Aware**: Uses recent conversation history (last 3 messages) for better inference
- **Automatic Processing**: Runs after message creation, before AI response generation

### AI Attribution & Context Enhancement (July 18, 2025 - 9:57 PM)
- **Fixed User Attribution**: Resolved critical issue where users appeared as "Unknown" in conversation history
- **Enhanced AI Accuracy**: AI now correctly identifies speakers for historical questions (e.g., "Who mentioned Airbnb?")
- **Expanded Context Window**: Increased conversation history from 20 to 50 messages for better context retention
- **Improved User Lookup**: Implemented efficient user ID to name resolution using database lookup map
- **Better Speaker Attribution**: All conversation history now shows proper user names instead of "Unknown"
- **Enhanced Memory**: AI can now reference older messages and correctly attribute statements to specific users

### Knowledge Graph as Primary Intelligence Source (July 21, 2025 - 5:37 PM)
- **Complete Architecture Transformation**: Knowledge graph now serves as PRIMARY intelligence source for multi-user context retrieval
- **Relationship-Based Intelligence**: AI uses intelligent context queries (`getIntelligentContext`) instead of linear conversation scanning
- **Multi-User Context Mastery**: AI successfully answers "what does X know about Y" queries by mapping person-entity relationships
- **Enhanced Context Service**: New `KnowledgeGraphService.getIntelligentContext()` provides structured relationship data including:
  - Relevant entities (locations, activities, topics)
  - Related people and their connections
  - Topic insights (who discussed what and when)
  - Entity connections (how things relate to each other)
- **Intelligent Response Generation**: AI now receives formatted knowledge graph context as primary source, conversation history as supplementary
- **Verified Multi-User Intelligence**: Successfully tested with complex queries like "create a summary of what each person knows"
- **Production-Ready**: System provides comprehensive relationship-based responses separating user knowledge domains

### Data Quality & Architecture Cleanup (July 21, 2025 - 2:24 AM)
- **Fixed Broken Entity Extraction**: Removed problematic `extractAndStoreEntities` function that created meaningless entities
- **Clean Knowledge Graph**: Eliminated nonsense entities like "for", "the", "it", "blue" being classified as people
- **Dual Database Architecture**: Neo4j handles OpenAI-powered entity extraction, PostgreSQL provides AI context access
- **Complete Entity Pipeline**: Every message now properly extracts entities and stores them in both databases
- **Quality Entity Extraction**: OpenAI GPT-4o extracts meaningful entities (locations, activities, time references)
- **Verified Integration**: AI successfully uses extracted entities for context-aware responses about locations and activities
- **Production Ready**: System now operates with clean data and reliable entity extraction pipeline

### Intelligent Relationship Mapping Achievement (July 21, 2025 - 5:37 PM)
- **Revolutionary Query Intelligence**: AI now answers "what does Mohammad know about Italian food?" style questions with precision
- **Relationship-First Architecture**: System prioritizes knowledge graph relationships over linear conversation history scanning
- **Multi-Domain Knowledge Separation**: AI distinguishes between different users' knowledge domains (e.g., Mohammad's restaurants vs Ali's hiking)
- **Comprehensive Context Formatting**: New `formatIntelligentContext()` method structures relationship data for optimal AI understanding
- **Entity-Relationship Intelligence**: System maps connections between people, topics, locations, and activities for intelligent retrieval
- **Production Verified**: Successfully handles complex multi-user queries with accurate relationship-based responses

### Comprehensive Testing & Script Evaluation System (July 28, 2025 - 6:42 PM)
- **15-Day Conversation Script**: Successfully imported comprehensive test dataset with 58 messages across 5 users (Emma, Jake, Sarah, Chloe, Ryan)
- **AI Mention Normalization**: Fixed critical bug where "@AI" mentions weren't triggering responses - now properly maps to "@AI Agent"
- **Anonymous User Support**: Enhanced AI processing to handle messages without userId, enabling comprehensive testing scenarios
- **Script Importer Service**: Built robust script parsing system that processes conversation data and creates users automatically
- **Python Evaluation Framework**: Created comprehensive testing suite with similarity scoring and category breakdown
- **Knowledge Graph Population**: System successfully processes realistic conversation data about Yosemite camping, music preferences, and group dynamics
- **AI Response Verification**: Confirmed AI correctly recalls Jake's Yosemite bear encounter story from imported conversation data
- **Production Testing Ready**: Full evaluation framework operational for measuring AI knowledge retention and response accuracy

### Knowledge Graph as Primary Intelligence Source (July 28, 2025 - 7:15 PM)
- **Complete AI Architecture Transformation**: AI now uses Neo4j knowledge graph as PRIMARY intelligence source instead of conversation history scanning
- **Entity-Relationship Intelligence**: System successfully maps connections between people, topics, events, and preferences through structured graph data
- **Enhanced Context Retrieval**: `getIntelligentContext()` method provides comprehensive relationship-based responses including:
  - Relevant entities (people, locations, activities, topics)
  - Related people and their connections to query topics
  - Topic insights (who discussed what and when)
  - Entity connections (how things relate to each other)
- **Multi-User Knowledge Separation**: AI distinguishes between different users' knowledge domains (Jake's outdoor activities, Emma's movie mentions, Ryan's music preferences)
- **Comprehensive Query Processing**: AI successfully answers complex questions like "what does Jake know about outdoor activities?" by analyzing entity relationships
- **Production Verified**: System provides accurate, context-aware responses based on structured knowledge graph data rather than linear conversation scanning

### Project Structure
```
├── client/          # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utility functions and API client
│   │   └── pages/       # Page components
├── server/          # Express backend
│   ├── services/    # Business logic services
│   ├── db.ts        # Database configuration
│   ├── routes.ts    # API route definitions
│   └── storage.ts   # Data access layer
├── shared/          # Shared TypeScript types and schemas
└── migrations/      # Database migration files
```

## Key Components

### Knowledge Graph System
- **Entity Extraction**: Automatically identifies people, topics, events, and dates from conversations
- **Relationship Mapping**: Tracks connections between entities and conversation context
- **Neo4j Integration**: Stores conversation data in Neo4j graph database for professional analysis
- **Developer Interface**: Direct access to Neo4j Browser for advanced querying and visualization

### AI Chat Features
- **OpenAI Integration**: Uses GPT-4o model for contextual responses
- **Mention System**: AI responds when @mentioned in conversations
- **Context Awareness**: Leverages conversation history and knowledge graph for personalized responses
- **Entity Recognition**: Extracts structured information from natural language

### User Management
- **Multi-user Support**: Create and switch between different chat personas
- **Avatar System**: Color-coded user avatars with initials
- **Activity Tracking**: Monitors user engagement and last activity times
- **Session Persistence**: Maintains user state across browser sessions

### Real-time Features
- **Live Updates**: React Query polling for near real-time message updates
- **Optimistic Updates**: Immediate UI feedback for user actions
- **Error Handling**: Graceful error recovery with user feedback

## Data Flow

### Message Flow
1. User types message in MessageInput component
2. Message sent to `/api/messages` endpoint
3. Backend processes message and extracts entities
4. AI generates response if mentioned
5. Knowledge graph updated with new entities/relationships
6. Frontend polls for updates and displays new messages

### Knowledge Graph Flow
1. AI service analyzes messages for entities
2. Entities stored in knowledge_graph_entities table
3. Relationships tracked in knowledge_graph_relationships table
4. Conversation threads grouped by topic and participants
5. Graph data accessible via `/api/knowledge-graph` endpoint

### User Activity Flow
1. User selection triggers activity update
2. Backend updates user's last_active_at timestamp
3. Frontend reflects active user state
4. User switching updates local state and server activity

## External Dependencies

### Core Dependencies
- **React Ecosystem**: React, React DOM, React Query for state management
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Database**: Neon PostgreSQL with Drizzle ORM
- **AI Services**: OpenAI API for chat completions and entity extraction
- **Styling**: Tailwind CSS with PostCSS processing

### Development Tools
- **Build**: Vite with TypeScript support
- **Database**: Drizzle Kit for migrations and schema management
- **Session**: connect-pg-simple for PostgreSQL session storage
- **WebSocket**: ws library for Neon database connections

### Authentication & Security
- **No Authentication**: Currently implements user switching without authentication
- **CORS**: Configured for development environment
- **Environment Variables**: DATABASE_URL and OPENAI_API_KEY required

## Deployment Strategy

### Development
- **Local Development**: `npm run dev` starts both frontend and backend
- **Hot Reload**: Vite HMR for frontend, nodemon-like restart for backend
- **Database**: Drizzle migrations via `npm run db:push`

### Production Build
- **Frontend**: Vite builds to `dist/public` directory
- **Backend**: esbuild bundles server to `dist/index.js`
- **Static Serving**: Express serves built frontend files
- **Environment**: NODE_ENV=production for optimized builds

### Database Management
- **Migrations**: Stored in `migrations/` directory
- **Schema**: Centralized in `shared/schema.ts`
- **Connection**: Neon serverless PostgreSQL with connection pooling

### Environment Configuration
- **DATABASE_URL**: PostgreSQL connection string (required)
- **OPENAI_API_KEY**: OpenAI API key for AI features (required)
- **NODE_ENV**: Environment mode (development/production)

The application is designed to be easily deployed on platforms like Replit, Vercel, or traditional hosting with minimal configuration changes.