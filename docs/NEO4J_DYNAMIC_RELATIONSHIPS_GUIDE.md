# Neo4j Dynamic Relationships Query Guide

## Overview
The system now creates intelligent, contextual relationships instead of generic "MENTIONS" or "DISCUSSES" relationships. These dynamic relationships capture semantic meaning with confidence scores.

## Example Dynamic Relationships Created
- `Jake --[ENJOYS_ACTIVITY]--> rock climbing (confidence: 0.9)`
- `Sarah --[ENJOYS_GENRE]--> jazz (confidence: 0.9)`
- `Sarah --[DISLIKES_GENRE]--> country music (confidence: 0.9)`
- `Jake --[ENJOYS_ACTIVITY]--> outdoor adventures (confidence: 0.8)`

## Neo4j Browser Queries

### See All Dynamic Relationships
```cypher
MATCH (a:Entity)-[r]->(b:Entity) 
WHERE type(r) <> 'MENTIONS' AND type(r) <> 'DISCUSSES' AND type(r) <> 'REFERS_TO' AND type(r) <> 'SENT' AND type(r) <> 'TO'
RETURN a.name, type(r), b.name, r.confidence, r.context
ORDER BY r.confidence DESC
```

### See Specific Relationship Types
```cypher
// See all activity enjoyment relationships
MATCH (a:Entity)-[r:ENJOYS_ACTIVITY]->(b:Entity) 
RETURN a.name, b.name, r.confidence, r.context

// See music preferences
MATCH (a:Entity)-[r:ENJOYS_GENRE|DISLIKES_GENRE]->(b:Entity) 
RETURN a.name, type(r), b.name, r.confidence

// See experiences at locations
MATCH (a:Entity)-[r:EXPERIENCED_AT]->(b:Entity) 
RETURN a.name, b.name, r.confidence, r.context
```

### See Person-Specific Relationships
```cypher
// See all of Jake's relationships
MATCH (jake:Entity {name: 'Jake'})-[r]->(activity:Entity) 
WHERE type(r) <> 'MENTIONS' AND type(r) <> 'DISCUSSES'
RETURN jake.name, type(r), activity.name, r.confidence

// See Sarah's music preferences
MATCH (sarah:Entity {name: 'Sarah'})-[r:ENJOYS_GENRE|DISLIKES_GENRE]->(music:Entity) 
RETURN sarah.name, type(r), music.name, r.confidence
```

### Comprehensive Relationship Overview
```cypher
MATCH (a:Entity)-[r]->(b:Entity) 
WHERE r.confidence IS NOT NULL
RETURN a.name as Person, 
       type(r) as RelationshipType, 
       b.name as Object, 
       r.confidence as Confidence,
       r.context as Context,
       r.timestamp as CreatedAt
ORDER BY r.confidence DESC, a.name
```

### High-Confidence Relationships Only
```cypher
MATCH (a:Entity)-[r]->(b:Entity) 
WHERE r.confidence > 0.8
RETURN a.name, type(r), b.name, r.confidence
ORDER BY r.confidence DESC
```

## Dynamic Relationship Types Generated
The system automatically creates contextual relationship types such as:
- `ENJOYS_ACTIVITY` (person enjoys an activity)
- `ENJOYS_GENRE` (person likes a music genre)
- `DISLIKES_GENRE` (person dislikes a music genre)
- `EXPERIENCED_AT` (person had an experience at a location)
- `PREFERS_OVER` (person prefers one thing over another)
- `WORKS_AT` (person works at a location)
- `LIVES_IN` (person lives in a location)
- And many more based on conversation context

## Confidence Scoring
- **0.9-1.0**: Very high confidence (explicitly stated preferences)
- **0.7-0.8**: High confidence (clearly implied relationships)  
- **0.6-0.7**: Medium confidence (contextually inferred)
- **Below 0.6**: Not stored (filtered out for quality)

## Why This Is Better Than Fixed Relationships
Instead of generic relationships like:
- `Jake --[DISCUSSES]--> hiking`
- `Sarah --[MENTIONS]--> music`

You now get semantic relationships like:
- `Jake --[ENJOYS_ACTIVITY]--> hiking`
- `Sarah --[ENJOYS_GENRE]--> jazz`
- `Sarah --[DISLIKES_GENRE]--> country`

This enables the AI to understand actual preferences and relationships rather than just conversation topics.