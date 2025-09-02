# AI Chat System with Knowledge Graph

An advanced conversational AI platform that creates dynamic, contextually-aware interactions through intelligent knowledge graph technologies and adaptive reasoning.

## 🚀 Live Demo

**[Try the Live App →](https://your-app-name.replit.app)**

> **To deploy:** Click the "Deploy" button in this Replit, then update this link with your actual deployment URL

[![Deploy to Replit](https://img.shields.io/badge/Deploy%20to-Replit-orange?style=for-the-badge&logo=replit)](https://replit.com/@m7md2216/MUGNet)

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

## 📖 About

This project is part of AI research comparing three different architectural approaches for conversational memory:
- **Neo4j + Knowledge Graph** (current implementation)
- **Pure LLM with full context**
- **LLM + RAG (Retrieval-Augmented Generation)**

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

## 🌐 Deployment Options

### **Production Deployment (Recommended)**

#### **Option 1: Vercel + Railway**
- **Frontend**: Deploy on [Vercel](https://vercel.com) (free tier available)
- **Backend**: Deploy on [Railway](https://railway.app) (includes PostgreSQL)
- **Neo4j**: Use [Neo4j AuraDB](https://neo4j.com/cloud/aura/) (free tier available)

#### **Option 2: Render**
- **Full-stack**: Deploy on [Render](https://render.com) (includes PostgreSQL)
- **Neo4j**: Use [Neo4j AuraDB](https://neo4j.com/cloud/aura/)

#### **Option 3: DigitalOcean/AWS/GCP**
- Deploy on any cloud provider with Docker
- Use managed databases (PostgreSQL + Neo4j)

### **Development/Demo**
- **Replit**: Quick setup for demos and development

### **Environment Variables Required**
```env
DATABASE_URL=postgresql://username:password@host:port/database
NEO4J_URI=neo4j+s://xxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password
OPENAI_API_KEY=sk-your_openai_key
```

### **Docker Deployment**
```bash
# Build and run with Docker
docker build -t ai-chat-system .
docker run -p 5000:5000 --env-file .env ai-chat-system
```

## 📄 License

MIT License - see LICENSE file for details.