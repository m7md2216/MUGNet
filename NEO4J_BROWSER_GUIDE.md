# Neo4j Browser Developer Guide

## Overview

This application uses Neo4j as a knowledge graph database to store and analyze conversation data. Instead of building custom React visualizations, we provide direct access to Neo4j Browser for professional graph exploration and querying.

## Setup Instructions

### 1. Install Neo4j

#### Option A: Neo4j Desktop (Recommended for Development)
- Download [Neo4j Desktop](https://neo4j.com/download/)
- Create a new project and database
- Set password and start the database
- Note the Bolt URL (typically `neo4j://localhost:7687`)

#### Option B: Neo4j Aura (Cloud)
- Sign up for [Neo4j Aura](https://neo4j.com/cloud/aura/)
- Create a free database instance
- Note the connection URI (e.g., `neo4j+s://xxxx.databases.neo4j.io`)

### 2. Configure Environment Variables

Create a `.env` file or set environment variables:

```bash
NEO4J_URI=neo4j://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
```

### 3. Access Neo4j Browser

- **Local**: Open http://localhost:7474 in your browser
- **Aura**: Use the provided browser URL from Neo4j Aura console

## Graph Schema

### Node Types

- **:User** - Chat participants
  - Properties: `name`, `initials`, `color`, `lastActiveAt`
- **:Message** - Individual chat messages
  - Properties: `text`, `timestamp`, `mentions`
- **:Topic** - Extracted conversation topics
  - Properties: `name`
- **:Entity** - Extracted entities (people, events, dates)
  - Properties: `name`, `type`

### Relationships

- **(:User)-[:SENT]→(:Message)** - User sent a message
- **(:Message)-[:TO]→(:User)** - Message directed to user
- **(:Message)-[:MENTIONS]→(:Topic)** - Message mentions topic
- **(:Message)-[:CONTAINS_ENTITY]→(:Entity)** - Message contains entity

## Sample Cypher Queries

### View Recent Conversations
```cypher
MATCH (u:User)-[:SENT]->(m:Message)
OPTIONAL MATCH (m)-[:TO]->(r:User)
OPTIONAL MATCH (m)-[:MENTIONS]->(t:Topic)
OPTIONAL MATCH (m)-[:CONTAINS_ENTITY]->(e:Entity)
RETURN u, m, r, t, e
ORDER BY m.timestamp DESC
LIMIT 100
```

### Find Messages About Specific Topic
```cypher
MATCH (m:Message)-[:MENTIONS]->(t:Topic {name: "Tesla"})
OPTIONAL MATCH (m)<-[:SENT]-(u:User)
OPTIONAL MATCH (m)-[:TO]->(r:User)
RETURN u, m, r, t
ORDER BY m.timestamp DESC
```

### User Conversation History
```cypher
MATCH (u:User {name: "Alice"})-[:SENT]->(m:Message)
OPTIONAL MATCH (m)-[:TO]->(recipient:User)
OPTIONAL MATCH (m)-[:MENTIONS]->(t:Topic)
OPTIONAL MATCH (m)-[:CONTAINS_ENTITY]->(e:Entity)
RETURN u, m, recipient, t, e
ORDER BY m.timestamp DESC
```

### Entity Network Analysis
```cypher
MATCH (e:Entity)
OPTIONAL MATCH (e)<-[:CONTAINS_ENTITY]-(m:Message)<-[:SENT]-(u:User)
OPTIONAL MATCH (m)-[:TO]->(recipient:User)
RETURN e, m, u, recipient
ORDER BY e.type, e.name
```

### Complete Graph Overview
```cypher
MATCH (n)
OPTIONAL MATCH (n)-[r]->(m)
WHERE labels(n) IN ['User', 'Message', 'Topic', 'Entity']
RETURN n, r, m
LIMIT 500
```

## Visualization Features

### Graph Visualization
- Use Neo4j Browser's built-in graph visualization
- Nodes are color-coded by type
- Relationships show conversation flow
- Interactive exploration with zoom and pan

### Data Analysis
- Filter by time periods
- Search for specific users or topics
- Export data for external analysis
- Create custom dashboards

## Troubleshooting

### Connection Issues
1. Verify Neo4j database is running
2. Check connection URI and credentials
3. Ensure port 7687 (Bolt) and 7474 (HTTP) are accessible
4. Review application logs for Neo4j connection errors

### Query Performance
- Use `LIMIT` clauses for large datasets
- Add indexes for frequently queried properties
- Use `EXPLAIN` to analyze query performance
- Consider pagination for large result sets

### Data Quality
- Check for missing relationships
- Verify entity extraction accuracy
- Monitor for duplicate nodes
- Regular database maintenance

## Advanced Usage

### Custom Queries
Build domain-specific queries for:
- Conversation pattern analysis
- User interaction mapping
- Topic trend analysis
- Entity relationship discovery

### Integration
- Export data to external analytics tools
- Create automated reports
- Build custom visualizations
- Integrate with BI platforms

## Security Notes
- Use appropriate authentication in production
- Restrict database access to authorized users
- Regular security updates
- Monitor query performance and access logs