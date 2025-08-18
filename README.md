# AI Chat System with Knowledge Graph

An advanced conversational AI platform that creates dynamic, contextually-aware interactions through intelligent knowledge graph technologies and adaptive reasoning.

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Radix UI** components with shadcn/ui styling
- **Tailwind CSS** for styling
- **React Query** for server state management
- **Wouter** for client-side routing

### Backend
- **Node.js** with Express
- **PostgreSQL** for core application data (messages, users, sessions)
- **Neo4j** for knowledge graph relationships
- **OpenAI GPT-4o** for AI responses and entity extraction
- **Drizzle ORM** for database operations

### Key Features
- **Multi-user chat system** with user management
- **Dynamic knowledge graph** that learns from conversations
- **Intelligent entity extraction** and relationship inference
- **Context-aware AI responses** using graph data
- **Real-time relationship storage** in Neo4j
- **Evaluation tools** for testing AI memory performance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Neo4j database
- OpenAI API key

### Environment Variables
```bash
DATABASE_URL=your_postgresql_url
NEO4J_URI=your_neo4j_uri
NEO4J_USERNAME=your_neo4j_username
NEO4J_PASSWORD=your_neo4j_password
OPENAI_API_KEY=your_openai_api_key
```

### Installation
```bash
# Install dependencies
npm install

# Set up database
npm run db:generate
npm run db:migrate

# Start development server
npm run dev
```

## 📁 Project Structure

```
├── client/              # React frontend
├── server/              # Express backend
├── shared/              # Shared types and schemas
├── docs/                # Documentation and guides
├── evaluation/          # AI testing and evaluation tools
├── scripts/             # Data import and utility scripts
└── attached_assets/     # Development artifacts (not in git)
```

## 🧠 How It Works

1. **Message Processing**: Users send messages through the React frontend
2. **Entity Extraction**: GPT-4o extracts entities (people, places, activities, times)
3. **Relationship Storage**: Entities and relationships stored in Neo4j graph
4. **Context Retrieval**: AI queries Neo4j for relevant context when answering
5. **Intelligent Responses**: GPT-4o generates responses using graph context + recent history

## 🔧 Development

- **Frontend**: `client/src/` - React components and pages
- **Backend**: `server/` - Express routes and services
- **Database**: `shared/schema.ts` - Shared database schemas
- **Neo4j**: `server/services/neo4j.ts` - Graph database operations

## 📖 Documentation

- [Neo4j Browser Guide](docs/NEO4J_BROWSER_GUIDE.md)
- [Dynamic Relationships](docs/NEO4J_DYNAMIC_RELATIONSHIPS_GUIDE.md)
- [Evaluation Tools](docs/EVALUATION_TOOLS_README.md)

## 🧪 Testing & Evaluation

The `evaluation/` folder contains comprehensive tools for testing AI memory performance across different architectural approaches.

## 📄 License

MIT License - see LICENSE file for details.