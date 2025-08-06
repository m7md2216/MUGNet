# AI Architecture Comparison Report

**Generated:** 2025-08-06 18:31:34
**Questions Tested:** 10
**Architectures Compared:** 3

## Architectures

**Pure LLM with Full Context:** Uses GPT-4o with entire conversation history in context window

**LLM + RAG:** Uses semantic search to retrieve relevant conversation chunks, then LLM to answer

**LLM + Knowledge Graph:** Uses Neo4j knowledge graph + GPT-4o (current system)

## Results by Question

### Q: Who said they would pop a red telephone booth in their carry-on?

**Pure LLM with Full Context:**
- Answer: Chloe said she would "pop one in my carry-on" in response to Ryan's joking request for a red telephone booth.
- Time: 3.01s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Chloe said she would pop a red telephone booth in her carry-on. She responded to Ryan's request with, "Sure, I’ll just pop one in my carry-on. 😜"
- Time: 0.87s
- Context Size: 4705 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec4b190>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.09s

### Q: Which song did Emma have on repeat?

**Pure LLM with Full Context:**
- Answer: Emma had "Midnight Reverie" by The Moonlighters on repeat. She said, "Ooh yes! 'Midnight Reverie,' right? I’ve had it on repeat. Love the vibes."
- Time: 0.76s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Emma had "Midnight Reverie" by The Moonlighters on repeat. She said, "Ooh yes! 'Midnight Reverie,' right? I’ve had it on repeat. Love the vibes."
- Time: 1.95s
- Context Size: 4312 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec65e90>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: Who encountered a bear during a camping trip?

**Pure LLM with Full Context:**
- Answer: Jake encountered a bear during a camping trip. He mentioned, "We did encounter a bear near our campsite! It was sniffing around our food stash. I nearly had a heart attack, but we made loud noises and it ran off."
- Time: 1.47s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Jake encountered a bear during a camping trip. He mentioned, "We did encounter a bear near our campsite! It was sniffing around our food stash."
- Time: 0.90s
- Context Size: 4293 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec74890>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.01s

### Q: What movie did Ryan recommend?

**Pure LLM with Full Context:**
- Answer: Ryan recommended the movie "The Galactic Heist." He mentioned, "I did! It was actually fun – cheesy effects but a good time."
- Time: 1.11s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Ryan recommended the movie "The Galactic Heist." He mentioned, "I did! It was actually fun – cheesy effects but a good time."
- Time: 1.33s
- Context Size: 4195 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec67690>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: Who prefers rock music over country music?

**Pure LLM with Full Context:**
- Answer: Ryan prefers rock music over country music. He mentioned, "I’m a rock/metal guy. Give me screaming guitars over banjos any day."
- Time: 0.66s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Ryan prefers rock music over country music. He mentioned, "I’m a rock/metal guy. Give me screaming guitars over banjos any day."
- Time: 0.82s
- Context Size: 4372 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec75010>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: What did Chloe say about her presentation?

**Pure LLM with Full Context:**
- Answer: Chloe said, "Surprisingly well. I was shaking at first, but then I told a little joke (thanks to @ryan’s idea) and people laughed, and I just flowed from there."
- Time: 1.04s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: I'm sorry, but there is no information in the provided conversation excerpts about Chloe's presentation.
- Time: 0.88s
- Context Size: 3922 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec85210>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: Who mentioned spicy food?

**Pure LLM with Full Context:**
- Answer: Emma mentioned spicy food. She said, "I grabbed a burrito. Extra hot sauce because this Monday needs some spice 🌶️."
- Time: 0.66s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Emma mentioned spicy food. She said, "I grabbed a burrito. Extra hot sauce because this Monday needs some spice 🌶️."
- Time: 0.63s
- Context Size: 4308 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec5a4d0>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: What did Jake say about his singing?

**Pure LLM with Full Context:**
- Answer: Jake joked about his singing talent by saying, "I warn you all, my singing talent is legendary — I’m sure the neighborhood cats will gather to applaud (or howl)." He also mentioned, "My showerhead gives me a standing ovation every morning."
- Time: 7.94s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: The provided conversation excerpts do not contain any information about Jake's singing or what he said about it.
- Time: 2.02s
- Context Size: 4134 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec85310>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: Who talked about weekend plans?

**Pure LLM with Full Context:**
- Answer: Emma initiated the conversation about weekend plans by saying, "Alright, midweek check-in – anyone up for doing something fun this weekend? We talked about not being boring, remember?" Jake responded positively, suggesting a hike or a day trip, and Sarah proposed going to the amusement park to try the new giant roller coaster. Emma then suggested bungee jumping jokingly, but eventually, they all agreed on having a picnic at Riverside Park.
- Time: 9.53s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Emma initiated the conversation about weekend plans by asking, "Alright, midweek check-in – anyone up for doing something fun this weekend? We talked about not being boring, remember?" Jake responded positively, suggesting, "Maybe another hike or a day trip somewhere scenic? Minus the bears this time." Chloe mentioned she might be busy with conference prep but would join if possible. Sarah suggested going to the amusement park to try the new giant roller coaster, but also expressed her fear of heights.
- Time: 4.03s
- Context Size: 4212 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec64610>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

### Q: What did Sarah say about the movie she was watching?

**Pure LLM with Full Context:**
- Answer: Sarah mentioned that she started watching "The Galactic Heist" on Netflix but fell asleep, blaming her Sunday laziness rather than the movie itself. She asked Ryan if it was worth finishing, to which Ryan replied that it picks up later and the twist at the end was wild.
- Time: 5.89s
- Context Size: 15360 chars

**LLM + RAG:**
- Answer: Sarah mentioned that she started watching the movie "The Galactic Heist" but fell asleep. She clarified that it was due to "Sunday laziness, not the movie." She then asked Ryan if it was worth finishing.
- Time: 2.08s
- Context Size: 4066 chars

**LLM + Knowledge Graph:**
- Answer: Error: HTTPConnectionPool(host='localhost', port=5000): Max retries exceeded with url: /api/messages (Caused by NewConnectionError('<urllib3.connection.HTTPConnection object at 0x7fcceec83b10>: Failed to establish a new connection: [Errno 111] Connection refused'))
- Time: 0.00s

## Performance Summary

**Pure LLM with Full Context:**
- Average Response Time: 3.21s
- Success Rate: 100.0%

**LLM + RAG:**
- Average Response Time: 1.55s
- Success Rate: 100.0%

**LLM + Knowledge Graph:**
- Average Response Time: 0.01s
- Success Rate: 0.0%

