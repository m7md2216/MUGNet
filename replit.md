# AI Chat Application - Replit Documentation

## Overview

This is a full-stack AI chat application featuring an intelligent chat system with knowledge graph capabilities, user management, and AI-powered responses with entity extraction. The project aims to provide a robust, multi-user AI chat experience, leveraging advanced knowledge representation to enable context-aware and intelligent conversations.

## User Preferences

Preferred communication style: Simple, everyday language.
**CRITICAL REQUIREMENT**: Absolutely no hardcoded names or manual semantic mapping - system must be completely dynamic and systematic.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **UI**: Radix UI components with shadcn/ui styling and Tailwind CSS
- **State Management**: React Query for server state
- **Routing**: Wouter for client-side routing
- **Build**: Vite

### Backend
- **Runtime**: Node.js with Express
- **Databases**: PostgreSQL (for core application data) and Neo4j (for knowledge graph)
- **ORM**: Drizzle ORM for PostgreSQL
- **AI Integration**: Direct OpenAI API calls (GPT-4o) for chat, entity extraction, and dynamic relationship inference.
- **Session Management**: Built-in session handling with PostgreSQL for persistence.

### Core Architectural Decisions
- **Dual Database Approach**: PostgreSQL for structured application data and Neo4j for complex knowledge graph relationships, enabling rich, context-aware AI interactions.
- **Simplified AI Orchestration**: Direct integration with OpenAI API (GPT-4o) replaces complex AI orchestration layers for improved performance and a cleaner codebase.
- **Knowledge Graph as Primary Intelligence Source**: The Neo4j knowledge graph is the core intelligence source for multi-user context retrieval, allowing the AI to understand relationships and answer complex queries about user knowledge domains.
- **Real-time Relationship Inference**: GPT-4o powered service analyzes messages to infer and store semantic relationships (e.g., ENJOYS_ACTIVITY, PREFERS_OVER) in Neo4j, enhancing AI's contextual understanding.
- **Developer-Centric Knowledge Graph Access**: Custom frontend graph visualization has been replaced with direct access to the professional Neo4j Browser for advanced querying and analysis.
- **Robust Entity Attribution**: Enhanced prompt engineering ensures correct attribution of message content to subjects rather than just senders in the knowledge graph.

## External Dependencies

- **React Ecosystem**: React, React DOM, @tanstack/react-query
- **UI Framework**: Radix UI, shadcn/ui, Tailwind CSS
- **Databases**: Neon Database (@neondatabase/serverless), Neo4j
- **ORM**: Drizzle ORM, Drizzle Kit
- **AI Services**: OpenAI API
- **Backend Framework**: Express
- **Session Management**: connect-pg-simple (for PostgreSQL session storage)
- **Build Tools**: Vite, esbuild