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

### Recent Changes (July 9, 2025)
- **Fixed Knowledge Graph Visualization**: Switched from MemStorage to DatabaseStorage for persistent data
- **Added Message Deletion**: Implemented DELETE /api/messages endpoint to clear all messages and knowledge graph data
- **Database Integration**: All messages, entities, and relationships now persist in PostgreSQL
- **Fixed Frontend Display**: Knowledge graph sidebar now shows real-time data from database
- **Enhanced UI**: Added clear messages functionality with proper cache invalidation
- **Knowledge Graph Rebuild**: Added "Rebuild Knowledge Graph" button to process all existing messages and extract entities from entire conversation history
- **Comprehensive Entity Extraction**: System now extracts entities from all messages, not just AI responses
- **Enhanced Graph Visualization**: Expanded sidebar to 500px width with larger graph (480x320), showing up to 10 nodes and 15 relationships
- **Improved Information Display**: All entities, relationships, and threads now show complete information with scrollable lists and hover effects
- **Full-Screen Knowledge Graph**: Added dedicated page at `/knowledge-graph` with full-screen visualization, zoom controls, and tabbed interface
- **Smart Grid Layout**: Replaced circular layout with grid-based positioning to prevent node overlaps and text cutoff
- **Responsive Design**: "Full View" link in sidebar opens comprehensive visualization when window space is limited
- **Scattered Layout**: Implemented natural scattered positioning with minimum distance enforcement to eliminate clustering
- **Optimized Display**: Reduced to 4 nodes in sidebar for clean visualization, full data available in full-screen view
- **List-Based Sidebar**: Replaced complex network graph with clean list format showing entities and relationships in readable cards

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
- **Conversation Threading**: Groups related messages by topic and participants
- **Graph Visualization**: Provides sidebar interface for exploring knowledge connections

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