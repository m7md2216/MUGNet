import neo4j from 'neo4j-driver';
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'neo4j+s://ba13305a.databases.neo4j.io',
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME || 'neo4j',
    process.env.NEO4J_PASSWORD || process.env.NEO4J_PASSWORD
  )
);

async function testNeo4jConnection() {
  const session = driver.session();
  
  try {
    console.log('Testing Neo4j connection...');
    
    // Test basic connection
    const result = await session.run('RETURN "Hello Neo4j" as message');
    console.log('✅ Connection successful:', result.records[0].get('message'));
    
    // Check for User nodes
    const userResult = await session.run('MATCH (u:User) RETURN u.name as name, u.id as id LIMIT 10');
    console.log('\n📊 Users in Neo4j:');
    userResult.records.forEach(record => {
      console.log(`  - ${record.get('name')} (ID: ${record.get('id')})`);
    });
    
    // Check for relationships
    const relationshipResult = await session.run(`
      MATCH (u1:User)-[r]->(u2:User) 
      RETURN u1.name as from, type(r) as relationship, u2.name as to, r.confidence as confidence
      LIMIT 20
    `);
    
    console.log('\n🔗 Relationships in Neo4j:');
    if (relationshipResult.records.length === 0) {
      console.log('  No relationships found');
    } else {
      relationshipResult.records.forEach(record => {
        console.log(`  - ${record.get('from')} -> ${record.get('relationship')} -> ${record.get('to')} (confidence: ${record.get('confidence')})`);
      });
    }
    
    // Check all nodes
    const allNodesResult = await session.run('MATCH (n) RETURN labels(n) as labels, count(n) as count');
    console.log('\n📈 Node counts:');
    allNodesResult.records.forEach(record => {
      console.log(`  - ${record.get('labels').join(', ')}: ${record.get('count')}`);
    });
    
  } catch (error) {
    console.error('❌ Neo4j Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

testNeo4jConnection();