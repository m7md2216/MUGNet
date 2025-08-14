import neo4j from 'neo4j-driver';

// Check environment variables
const neo4jUri = process.env.NEO4J_URI;
const neo4jUsername = process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;

console.log('Neo4j Config:', {
  uri: neo4jUri,
  username: neo4jUsername,
  password: neo4jPassword ? '***provided***' : '***missing***'
});

const driver = neo4j.driver(
  neo4jUri,
  neo4j.auth.basic(neo4jUsername, neo4jPassword),
  { disableLosslessIntegers: true }
);

async function investigateFriendRelationships() {
  const session = driver.session();
  
  try {
    console.log('\n=== INVESTIGATING "FRIEND" ENTITIES ===\n');
    
    // 1. Find all entities containing "friend"
    console.log('1. All entities containing "friend":');
    const friendEntities = await session.run(
      `MATCH (n) 
       WHERE toLower(n.name) CONTAINS "friend" 
       RETURN labels(n) as labels, n.name as name, properties(n) as props 
       ORDER BY n.name`
    );
    
    friendEntities.records.forEach(record => {
      console.log(`   ${record.get('labels')} - "${record.get('name')}" - ${JSON.stringify(record.get('props'))}`);
    });
    
    // 2. Find all relationships involving "friend" as source
    console.log('\n2. Relationships FROM entities containing "friend":');
    const fromFriend = await session.run(
      `MATCH (from)-[r]->(to) 
       WHERE toLower(from.name) CONTAINS "friend"
       RETURN from.name as from_entity, type(r) as relationship, to.name as to_entity, r.timestamp as timestamp
       ORDER BY r.timestamp DESC LIMIT 20`
    );
    
    fromFriend.records.forEach(record => {
      console.log(`   "${record.get('from_entity')}" --[${record.get('relationship')}]--> "${record.get('to_entity')}" (${record.get('timestamp')})`);
    });
    
    // 3. Find all relationships involving "friend" as target
    console.log('\n3. Relationships TO entities containing "friend":');
    const toFriend = await session.run(
      `MATCH (from)-[r]->(to) 
       WHERE toLower(to.name) CONTAINS "friend"
       RETURN from.name as from_entity, type(r) as relationship, to.name as to_entity, r.timestamp as timestamp
       ORDER BY r.timestamp DESC LIMIT 20`
    );
    
    toFriend.records.forEach(record => {
      console.log(`   "${record.get('from_entity')}" --[${record.get('relationship')}]--> "${record.get('to_entity')}" (${record.get('timestamp')})`);
    });
    
    // 4. Look for purr-well soon vibes relationships specifically
    console.log('\n4. All relationships involving purr-well soon vibes:');
    const purrVibes = await session.run(
      `MATCH (from)-[r]->(to) 
       WHERE toLower(from.name) CONTAINS "cat" OR toLower(to.name) CONTAINS "purr" OR toLower(type(r)) CONTAINS "purr"
       RETURN from.name as from_entity, type(r) as relationship, to.name as to_entity, r.timestamp as timestamp
       ORDER BY r.timestamp DESC LIMIT 20`
    );
    
    purrVibes.records.forEach(record => {
      console.log(`   "${record.get('from_entity')}" --[${record.get('relationship')}]--> "${record.get('to_entity')}" (${record.get('timestamp')})`);
    });
    
    // 5. Look for Chloe's relationships for context
    console.log('\n5. All relationships involving Chloe:');
    const chloeRelations = await session.run(
      `MATCH (from)-[r]->(to) 
       WHERE toLower(from.name) CONTAINS "chloe" OR toLower(to.name) CONTAINS "chloe"
       RETURN from.name as from_entity, type(r) as relationship, to.name as to_entity, r.timestamp as timestamp
       ORDER BY r.timestamp DESC LIMIT 20`
    );
    
    chloeRelations.records.forEach(record => {
      console.log(`   "${record.get('from_entity')}" --[${record.get('relationship')}]--> "${record.get('to_entity')}" (${record.get('timestamp')})`);
    });
    
  } catch (error) {
    console.error('Investigation failed:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

investigateFriendRelationships();