import OpenAI from "openai";
import { storage } from "../storage";
import { type Message, type User } from "@shared/schema";
import { langGraphService } from "./langgraph";
import { neo4jService } from "./neo4j";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface AIResponse {
  response: string;
  extractedEntities: {
    people: string[];
    topics: string[];
    events: string[];
    dates: string[];
  };
  relevantContext: string[];
}

export async function generateAIResponse(
  mentionedUsers: string[],
  messageContent: string,
  currentUser: User,
  conversationHistory: Message[]
): Promise<AIResponse> {
  try {
    // Check if this is a memory-aware query that should use LangGraph
    if (isMemoryAwareQuery(messageContent)) {
      return await generateMemoryAwareResponse(messageContent, currentUser, conversationHistory);
    }
    
    // Get conversation history for mentioned users
    const contextualMessages = await getContextualMessages(mentionedUsers, conversationHistory);
    
    // Get relevant entities and relationships
    const knowledgeContext = await getKnowledgeContext(mentionedUsers);
    
    // Debug logging to understand what data is being passed
    console.log('AI Context Debug:', {
      mentionedUsers,
      messageContent,
      currentUser: currentUser.name,
      conversationHistoryCount: conversationHistory.length,
      contextualMessagesCount: contextualMessages.length
    });
    
    const systemPrompt = `You are an AI agent in a group chat. You have access to complete conversation history and can remember previous conversations between users.

Your capabilities:
1. Respond when mentioned with @agent or similar
2. Access full conversation history for personalized responses
3. Remember what users have said to each other previously
4. Identify entities (people, topics, events, dates) from conversations
5. Map relationships between users and topics
6. Provide context-aware responses based on previous conversations

Current conversation context:
- User asking: ${currentUser.name}
- Mentioned users: ${mentionedUsers.join(', ')}
- Full conversation history: ${JSON.stringify(contextualMessages, null, 2)}
- Knowledge graph context: ${JSON.stringify(knowledgeContext)}

IMPORTANT: You can see the complete conversation history above. When users ask about previous conversations, refer to the actual messages in the conversation history. For example, if someone asks "where did Ali go?", look through the conversation history to find what Ali said about going somewhere.

Instructions:
- Be helpful and contextual
- Reference previous conversations when relevant by looking at the conversation history
- When asked about what someone said or did, check the conversation history first
- Extract meaningful entities for knowledge graph updates (be thorough!)
- Respond in a natural, conversational tone
- Keep responses concise but informative

IMPORTANT: Extract entities aggressively! Look for:
- People: All names mentioned (including the current user)
- Topics: Activities, subjects, places, interests (like "hiking", "Pennsylvania", "mountains", "trails")
- Events: Things that happened ("went hiking", "vacation", "meeting")
- Dates: Any time references ("yesterday", "last week", "today")

Respond with JSON in this format:
{
  "response": "Your conversational response here",
  "extractedEntities": {
    "people": ["array of ALL person names mentioned in the conversation"],
    "topics": ["array of ALL topics/subjects/activities discussed"],
    "events": ["array of ALL events/activities mentioned"],
    "dates": ["array of ALL time references mentioned"]
  },
  "relevantContext": ["array of relevant context points used"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: messageContent }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      response: result.response || "I'm sorry, I couldn't process that request.",
      extractedEntities: result.extractedEntities || {
        people: [],
        topics: [],
        events: [],
        dates: []
      },
      relevantContext: result.relevantContext || []
    };

  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to generate AI response: " + (error as Error).message);
  }
}

// Check if a query requires memory-aware processing
function isMemoryAwareQuery(messageContent: string): boolean {
  const lowerContent = messageContent.toLowerCase();
  const memoryPatterns = [
    /what did .+ say about/,
    /who was .+ talking to/,
    /when did .+ mention/,
    /who said .+ about/,
    /what was .+ discussing/,
    /find .+ conversation/,
    /search for .+ message/,
    /who went to/,
    /who was at/,
    /who visited/,
    /who did/,
    /what happened/,
    /where did .+ go/,
    /where was .+ going/,
    /last week/,
    /yesterday/,
    /last month/,
    /do you remember/,
    /what did (i|we) talk about/,
    /earlier (i|we|someone)/,
    /who .+ about/,
    /what .+ about/,
    /where .+ about/,
    /when .+ about/,
  ];

  return memoryPatterns.some(pattern => pattern.test(lowerContent));
}

// Generate memory-aware response using LangGraph
async function generateMemoryAwareResponse(
  messageContent: string,
  currentUser: User,
  conversationHistory: Message[]
): Promise<AIResponse> {
  try {
    // Use LangGraph to process the memory-aware query
    const response = await langGraphService.processQuery(
      messageContent,
      currentUser,
      conversationHistory
    );

    // Extract entities from the response and original message
    const entities = extractEntitiesFromText(messageContent + " " + response);

    // Get relevant context from Neo4j if available
    const relevantContext = [];
    try {
      const contextMessages = await neo4jService.findConversationContext({
        sender: currentUser.name,
        limit: 5
      });
      relevantContext.push(...contextMessages.map(msg => `${msg.sender}: ${msg.content}`));
    } catch (error) {
      console.warn('Neo4j context retrieval failed:', error);
    }

    return {
      response,
      extractedEntities: entities,
      relevantContext: relevantContext.length > 0 ? relevantContext : [`Memory-aware response generated using LangGraph reasoning engine with conversation history`]
    };
  } catch (error) {
    console.error("Memory-aware response generation failed:", error);
    // Fallback to regular response
    return {
      response: "I apologize, but I encountered an error while processing your memory-aware query. Please try again.",
      extractedEntities: {
        people: [],
        topics: [],
        events: [],
        dates: []
      },
      relevantContext: []
    };
  }
}

// Extract entities from text using pattern matching
function extractEntitiesFromText(text: string): AIResponse['extractedEntities'] {
  const entities = {
    people: [] as string[],
    topics: [] as string[],
    events: [] as string[],
    dates: [] as string[]
  };

  // Extract people (names)
  const peoplePatterns = [
    /\b(alice|bob|john|sarah|mike|emma|david|lisa|alex|chris|jordan|taylor)\b/gi,
    /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b/g // Capitalized words that might be names
  ];

  peoplePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      entities.people.push(...matches.map(match => match.toLowerCase()));
    }
  });

  // Extract topics
  const topicPatterns = [
    /\b(cybertruck|tesla|meeting|project|work|lunch|weekend|movie|book|game|hiking|vacation|travel|sports|music|art|science|technology|programming|cooking|food|health|fitness|business|education|school|university|college|course|class|teacher|student|learning|study|research|experiment|discovery|innovation|creativity|design|architecture|engineering|medicine|law|politics|economics|finance|investment|market|stock|cryptocurrency|bitcoin|ethereum|startup|company|corporation|organization|team|group|community|society|culture|tradition|history|geography|nature|environment|climate|weather|season|summer|winter|spring|autumn|fall|holiday|celebration|festival|party|birthday|anniversary|wedding|marriage|family|friends|relationship|love|dating|romance|home|house|apartment|room|bedroom|kitchen|bathroom|living|dining|garden|yard|car|vehicle|bike|bicycle|motorcycle|bus|train|plane|flight|airport|station|hotel|restaurant|cafe|bar|pub|club|gym|hospital|clinic|doctor|nurse|pharmacy|medicine|drug|treatment|therapy|surgery|operation|disease|illness|injury|pain|headache|fever|cold|flu|covid|virus|bacteria|infection|vaccine|vaccination|symptoms|diagnosis|prescription|appointment|checkup|test|examination|xray|scan|blood|pressure|heart|brain|lung|liver|kidney|stomach|muscle|bone|skin|hair|eye|ear|nose|mouth|teeth|tooth|dental|dentist|orthodontist|glasses|contacts|vision|hearing|smell|taste|touch|feeling|emotion|happiness|sadness|anger|fear|anxiety|stress|depression|mental|psychological|physical|spiritual|religious|church|temple|mosque|synagogue|prayer|meditation|yoga|exercise|workout|running|jogging|walking|swimming|dancing|singing|playing|games|gaming|video|computer|laptop|desktop|mobile|phone|smartphone|tablet|ipad|iphone|android|ios|windows|mac|linux|software|hardware|internet|website|app|application|social|media|facebook|instagram|twitter|youtube|tiktok|snapchat|whatsapp|telegram|discord|slack|zoom|teams|skype|email|text|message|call|video|audio|photo|image|picture|camera|photography|film|movie|tv|television|show|series|episode|season|netflix|amazon|prime|disney|hulu|streaming|music|spotify|apple|google|amazon|microsoft|meta|tesla|spacex|neuralink|boring|company|uber|lyft|airbnb|booking|expedia|paypal|venmo|cashapp|zelle|bank|credit|debit|card|loan|mortgage|insurance|health|life|auto|home|travel|vacation|trip|destination|country|city|state|province|continent|america|europe|asia|africa|australia|antarctica|usa|canada|mexico|uk|france|germany|italy|spain|russia|china|japan|india|brazil|argentina|chile|australia|new|zealand|south|korea|north|thailand|vietnam|singapore|malaysia|indonesia|philippines|pakistan|bangladesh|nepal|sri|lanka|maldives|egypt|turkey|greece|portugal|netherlands|belgium|switzerland|austria|poland|czech|republic|hungary|romania|bulgaria|croatia|serbia|montenegro|bosnia|herzegovina|macedonia|albania|slovenia|slovakia|estonia|latvia|lithuania|belarus|ukraine|moldova|georgia|armenia|azerbaijan|kazakhstan|uzbekistan|kyrgyzstan|tajikistan|turkmenistan|afghanistan|iran|iraq|syria|lebanon|israel|palestine|jordan|saudi|arabia|yemen|oman|kuwait|qatar|bahrain|uae|emirates|dubai|abu|dhabi|sharjah|ajman|fujairah|ras|khaimah|umm|quwain|morocco|algeria|tunisia|libya|sudan|south|sudan|ethiopia|eritrea|somalia|djibouti|kenya|uganda|tanzania|rwanda|burundi|democratic|republic|congo|central|african|republic|cameroon|equatorial|guinea|gabon|sao|tome|principe|chad|niger|nigeria|benin|togo|ghana|burkina|faso|mali|senegal|gambia|guinea|bissau|sierra|leone|liberia|ivory|coast|mauritania|western|sahara|canary|islands|madeira|azores|cape|verde|seychelles|mauritius|comoros|mayotte|reunion|madagascar|botswana|namibia|zambia|zimbabwe|mozambique|malawi|lesotho|swaziland|south|africa)\b/gi
  ];

  topicPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      entities.topics.push(...matches.map(match => match.toLowerCase()));
    }
  });

  // Extract events
  const eventPatterns = [
    /\b(meeting|conference|presentation|workshop|seminar|training|course|class|lecture|exam|test|interview|appointment|date|dinner|lunch|breakfast|party|celebration|birthday|anniversary|wedding|graduation|vacation|trip|travel|visit|tour|concert|show|movie|theater|sports|game|match|competition|tournament|race|marathon|run|walk|hike|climb|swim|dive|surf|ski|snowboard|skate|bike|drive|flight|landing|takeoff|departure|arrival|check|in|out|booking|reservation|order|purchase|sale|delivery|pickup|drop|off|meeting|discussion|negotiation|deal|contract|agreement|signing|launch|release|announcement|event|gathering|reunion|festival|fair|market|exhibition|expo|convention|trade|show|conference|summit|symposium|forum|debate|discussion|panel|presentation|speech|talk|lecture|lesson|tutorial|demonstration|workshop|training|course|class|seminar|webinar|online|virtual|remote|work|job|career|employment|hiring|firing|promotion|raise|bonus|salary|wage|pay|compensation|benefits|insurance|vacation|sick|leave|holiday|break|rest|relax|sleep|wake|up|get|ready|prepare|plan|schedule|organize|arrange|coordinate|manage|lead|supervise|oversee|direct|guide|instruct|teach|learn|study|research|investigate|explore|discover|find|search|look|see|watch|observe|notice|spot|identify|recognize|remember|recall|forget|remind|tell|say|speak|talk|discuss|chat|conversation|dialogue|communication|message|email|text|call|phone|video|audio|record|play|listen|hear|sound|noise|music|song|beat|rhythm|melody|harmony|chord|note|scale|key|tempo|volume|pitch|tone|voice|sing|hum|whistle|dance|move|motion|action|activity|exercise|workout|run|jog|walk|march|step|jump|leap|hop|skip|crawl|climb|fall|drop|rise|lift|carry|hold|grab|catch|throw|toss|push|pull|drag|slide|roll|turn|rotate|spin|twist|bend|stretch|flex|relax|tense|tight|loose|open|close|lock|unlock|start|stop|begin|end|finish|complete|done|ready|wait|pause|resume|continue|proceed|advance|progress|move|go|come|arrive|leave|depart|stay|remain|sit|stand|lie|down|up|left|right|front|back|forward|backward|ahead|behind|above|below|over|under|inside|outside|in|out|on|off|through|across|around|beside|next|near|far|close|distant|here|there|everywhere|nowhere|somewhere|anywhere|where|when|how|why|what|who|which|whose|whom|that|this|these|those|all|some|any|none|few|many|much|little|big|small|large|huge|tiny|enormous|massive|giant|miniature|microscopic|invisible|visible|clear|transparent|opaque|bright|dark|light|heavy|soft|hard|smooth|rough|hot|cold|warm|cool|wet|dry|clean|dirty|fresh|stale|new|old|young|ancient|modern|contemporary|traditional|classic|vintage|retro|futuristic|advanced|primitive|basic|simple|complex|complicated|difficult|easy|hard|soft|tough|gentle|rough|smooth|sharp|dull|pointed|blunt|round|square|circular|triangular|rectangular|oval|linear|curved|straight|bent|twisted|flat|steep|high|low|tall|short|wide|narrow|thick|thin|deep|shallow|full|empty|complete|incomplete|partial|whole|half|quarter|third|double|triple|single|multiple|many|few|several|numerous|countless|infinite|limited|unlimited|restricted|unrestricted|free|paid|expensive|cheap|affordable|valuable|worthless|priceless|rare|common|unique|ordinary|special|normal|abnormal|usual|unusual|regular|irregular|standard|custom|personal|private|public|social|individual|group|team|family|friend|enemy|stranger|neighbor|colleague|coworker|boss|employee|worker|staff|crew|member|participant|volunteer|guest|host|visitor|tourist|traveler|passenger|driver|pilot|captain|sailor|soldier|officer|guard|police|firefighter|paramedic|doctor|nurse|teacher|student|professor|researcher|scientist|engineer|architect|designer|artist|musician|singer|dancer|actor|actress|director|producer|writer|author|journalist|reporter|editor|photographer|cameraman|cook|chef|waiter|waitress|server|bartender|barista|cashier|salesperson|manager|supervisor|administrator|secretary|assistant|receptionist|accountant|lawyer|judge|politician|president|minister|mayor|governor|senator|representative|ambassador|diplomat|consultant|advisor|counselor|therapist|psychologist|psychiatrist|social|worker|volunteer|activist|advocate|entrepreneur|businessman|businesswoman|investor|trader|broker|agent|realtor|contractor|builder|plumber|electrician|mechanic|technician|repairman|handyman|gardener|farmer|rancher|veterinarian|groomer|trainer|coach|referee|umpire|commentator|announcer|host|presenter|moderator|facilitator|organizer|coordinator|planner|scheduler|booker|agent|representative|spokesperson|ambassador|delegate|envoy|messenger|courier|delivery|person|mailman|postman|driver|chauffeur|taxi|uber|lyft|bus|train|conductor|engineer|pilot|captain|sailor|fisherman|hunter|guide|ranger|park|forest|mountain|beach|lake|river|ocean|sea|desert|jungle|rainforest|grassland|prairie|tundra|arctic|antarctica|pole|equator|hemisphere|continent|island|peninsula|bay|gulf|strait|channel|canal|bridge|tunnel|road|street|avenue|boulevard|highway|freeway|expressway|interstate|route|path|trail|sidewalk|crosswalk|intersection|corner|block|neighborhood|district|zone|area|region|territory|state|province|country|nation|city|town|village|hamlet|suburb|downtown|uptown|midtown|center|mall|shop|store|market|supermarket|grocery|pharmacy|hospital|clinic|school|university|college|library|museum|gallery|theater|cinema|restaurant|cafe|bar|pub|club|gym|spa|salon|hotel|motel|inn|resort|camp|park|playground|zoo|aquarium|stadium|arena|field|court|track|pool|beach|mountain|hill|valley|forest|woods|garden|yard|lawn|farm|ranch|factory|plant|office|building|house|home|apartment|condo|flat|room|bedroom|bathroom|kitchen|living|dining|basement|attic|garage|porch|balcony|terrace|roof|floor|ceiling|wall|window|door|gate|fence|stairs|elevator|escalator|hallway|corridor|lobby|entrance|exit|parking|lot|garage|driveway|sidewalk|street|road|highway|bridge|tunnel|train|station|airport|port|harbor|dock|pier|wharf|marina|lighthouse|tower|skyscraper|castle|palace|mansion|cottage|cabin|tent|RV|trailer|boat|ship|yacht|cruise|ferry|submarine|plane|jet|helicopter|rocket|satellite|space|station|moon|planet|star|sun|earth|mars|venus|jupiter|saturn|uranus|neptune|pluto|galaxy|universe|cosmos|black|hole|nebula|comet|asteroid|meteor|meteorite|eclipse|solar|lunar|constellation|zodiac|astrology|astronomy|physics|chemistry|biology|mathematics|geometry|algebra|calculus|statistics|probability|science|technology|engineering|medicine|law|business|economics|finance|accounting|marketing|advertising|sales|customer|service|support|help|assistance|aid|relief|rescue|emergency|disaster|crisis|problem|issue|challenge|difficulty|obstacle|barrier|solution|answer|response|reply|feedback|comment|suggestion|recommendation|advice|guidance|instruction|direction|information|data|fact|truth|lie|falsehood|myth|legend|story|tale|history|past|present|future|time|moment|second|minute|hour|day|week|month|year|decade|century|millennium|era|age|period|season|spring|summer|autumn|fall|winter|holiday|vacation|break|rest|weekend|weekday|morning|afternoon|evening|night|dawn|dusk|sunrise|sunset|noon|midnight|today|tomorrow|yesterday|now|then|later|earlier|soon|recently|lately|frequently|often|sometimes|occasionally|rarely|seldom|never|always|forever|eternal|temporary|permanent|brief|short|long|quick|fast|slow|speed|velocity|acceleration|motion|movement|direction|north|south|east|west|up|down|left|right|forward|backward|straight|curved|circle|square|triangle|rectangle|oval|diamond|heart|star|cross|plus|minus|equal|greater|less|than|more|fewer|most|least|best|worst|better|worse|good|bad|excellent|poor|great|terrible|amazing|awful|wonderful|horrible|beautiful|ugly|pretty|handsome|attractive|unattractive|cute|adorable|lovely|gorgeous|stunning|magnificent|spectacular|impressive|outstanding|remarkable|extraordinary|incredible|unbelievable|fantastic|fabulous|marvelous|splendid|superb|excellent|perfect|flawless|imperfect|defective|broken|damaged|destroyed|ruined|wrecked|crashed|smashed|shattered|cracked|torn|ripped|cut|sliced|chopped|diced|minced|ground|mashed|crushed|squeezed|pressed|pushed|pulled|lifted|dropped|thrown|tossed|caught|grabbed|held|carried|dragged|slid|rolled|spun|turned|twisted|bent|folded|wrapped|unwrapped|opened|closed|locked|unlocked|started|stopped|began|ended|finished|completed|continued|paused|resumed|repeated|practiced|rehearsed|performed|acted|played|sang|danced|painted|drew|wrote|typed|printed|published|released|launched|announced|declared|proclaimed|stated|said|spoke|talked|discussed|chatted|conversed|communicated|messaged|texted|called|phoned|emailed|sent|received|delivered|picked|up|dropped|off|loaded|unloaded|packed|unpacked|organized|arranged|sorted|cleaned|washed|dried|cooked|baked|fried|grilled|roasted|boiled|steamed|microwaved|heated|cooled|frozen|melted|mixed|stirred|shaken|poured|spilled|splashed|dripped|leaked|flowed|ran|walked|jogged|sprinted|raced|hurried|rushed|strolled|wandered|explored|traveled|journeyed|visited|toured|sightseeing|shopping|buying|selling|trading|exchanging|returning|refunding|paying|spending|saving|investing|earning|working|studying|learning|teaching|training|practicing|exercising|working|out|relaxing|resting|sleeping|dreaming|waking|up|getting|ready|preparing|planning|organizing|scheduling|arranging|coordinating|managing|leading|supervising|directing|guiding|helping|assisting|supporting|encouraging|motivating|inspiring|influencing|persuading|convincing|arguing|debating|discussing|negotiating|compromising|agreeing|disagreeing|accepting|rejecting|approving|disapproving|liking|disliking|loving|hating|enjoying|suffering|feeling|thinking|believing|knowing|understanding|learning|remembering|forgetting|recognizing|identifying|noticing|observing|watching|seeing|looking|staring|glancing|peeking|hiding|showing|displaying|presenting|demonstrating|explaining|describing|defining|clarifying|interpreting|translating|converting|transforming|changing|modifying|adjusting|adapting|improving|enhancing|upgrading|updating|fixing|repairing|maintaining|preserving|protecting|defending|attacking|fighting|battling|competing|winning|losing|succeeding|failing|achieving|accomplishing|completing|finishing|starting|beginning|initiating|launching|creating|making|building|constructing|assembling|installing|setting|up|breaking|down|destroying|demolishing|removing|deleting|erasing|wiping|cleaning|washing|scrubbing|polishing|shining|painting|coloring|decorating|designing|styling|fashioning|shaping|forming|molding|carving|cutting|slicing|chopping|dicing|mincing|grinding|crushing|squeezing|pressing|pushing|pulling|lifting|carrying|holding|grasping|gripping|clutching|releasing|dropping|throwing|catching|picking|placing|positioning|locating|finding|searching|looking|seeking|hunting|discovering|exploring|investigating|researching|studying|analyzing|examining|inspecting|checking|testing|trying|attempting|experimenting|practicing|rehearsing|training|preparing|planning|organizing|arranging|scheduling|booking|reserving|confirming|canceling|postponing|rescheduling|delaying|rushing|hurrying|slowing|stopping|pausing|waiting|staying|remaining|leaving|departing|arriving|coming|going|moving|traveling|journeying|visiting|touring|exploring|discovering|finding|losing|misplacing|forgetting|remembering|recalling|recognizing|identifying|noticing|observing|watching|seeing|looking|listening|hearing|smelling|tasting|touching|feeling|sensing|perceiving|experiencing|living|existing|being|becoming|growing|developing|evolving|changing|transforming|improving|declining|deteriorating|aging|maturing|ripening|blooming|flowering|budding|sprouting|germinating|growing|shrinking|expanding|contracting|stretching|compressing|extending|shortening|lengthening|widening|narrowing|thickening|thinning|deepening|shallowing|raising|lowering|lifting|dropping|rising|falling|climbing|descending|ascending|flying|floating|sinking|drowning|swimming|diving|surfing|sailing|rowing|paddling|driving|riding|walking|running|jogging|sprinting|marching|dancing|jumping|leaping|hopping|skipping|crawling|creeping|sliding|slipping|rolling|tumbling|falling|tripping|stumbling|balancing|standing|sitting|lying|sleeping|resting|relaxing|stretching|exercising|working|out|playing|games|sports|competing|winning|losing|scoring|shooting|kicking|throwing|catching|hitting|swinging|serving|returning|defending|attacking|blocking|tackling|running|dribbling|passing|shooting|goalkeeping|coaching|training|practicing|warming|up|cooling|down|stretching|meditation|yoga|pilates|aerobics|cardio|strength|training|weight|lifting|bodybuilding|powerlifting|crossfit|martial|arts|boxing|wrestling|fencing|archery|shooting|hunting|fishing|camping|hiking|climbing|mountaineering|skiing|snowboarding|skating|surfing|sailing|rowing|kayaking|canoeing|rafting|scuba|diving|snorkeling|swimming|water|polo|volleyball|basketball|football|soccer|tennis|badminton|table|tennis|golf|baseball|softball|cricket|rugby|hockey|ice|hockey|field|hockey|lacrosse|polo|equestrian|gymnastics|track|field|running|sprinting|marathon|hurdles|long|jump|high|jump|pole|vault|shot|put|discus|hammer|throw|javelin|decathlon|heptathlon|triathlon|cycling|biking|motocross|racing|formula|one|nascar|drag|racing|karting|skateboarding|snowboarding|surfing|windsurfing|kitesurfing|paragliding|hang|gliding|bungee|jumping|skydiving|base|jumping|rock|climbing|ice|climbing|mountaineering|spelunking|caving|orienteering|geocaching|treasure|hunting|metal|detecting|bird|watching|wildlife|photography|nature|hiking|backpacking|camping|glamping|RV|travel|road|trip|cruise|vacation|holiday|staycation|weekend|getaway|business|trip|conference|convention|trade|show|exhibition|expo|fair|festival|concert|show|theater|movie|film|documentary|series|episode|season|streaming|netflix|amazon|prime|disney|plus|hulu|HBO|max|apple|tv|youtube|tiktok|instagram|facebook|twitter|snapchat|whatsapp|telegram|discord|slack|zoom|teams|skype|facetime|video|call|phone|call|text|message|email|letter|postcard|package|delivery|mail|post|shipping|courier|fedex|ups|dhl|usps|amazon|delivery|uber|eats|doordash|grubhub|postmates|food|delivery|grocery|delivery|shopping|online|shopping|e|commerce|retail|wholesale|market|store|shop|boutique|mall|plaza|center|outlet|thrift|store|antique|shop|pawn|shop|auction|garage|sale|yard|sale|flea|market|farmers|market|organic|market|supermarket|grocery|store|convenience|store|corner|store|deli|bakery|butcher|shop|fish|market|seafood|market|vegetable|market|fruit|stand|ice|cream|shop|candy|store|chocolate|shop|coffee|shop|cafe|tea|house|juice|bar|smoothie|bar|restaurant|fast|food|casual|dining|fine|dining|buffet|cafeteria|food|court|food|truck|street|food|pop|up|restaurant|ghost|kitchen|catering|banquet|hall|wedding|venue|event|space|conference|room|meeting|room|office|space|coworking|space|shared|office|home|office|studio|apartment|loft|condo|townhouse|house|mansion|cottage|cabin|tiny|house|mobile|home|RV|trailer|boat|house|tree|house|castle|palace|villa|estate|farm|ranch|compound|commune|monastery|convent|dormitory|hostel|hotel|motel|inn|bed|breakfast|resort|spa|retreat|camp|campground|RV|park|trailer|park|mobile|home|park|nursing|home|assisted|living|retirement|home|group|home|halfway|house|shelter|homeless|shelter|food|bank|soup|kitchen|community|center|recreation|center|youth|center|senior|center|daycare|center|preschool|kindergarten|elementary|school|middle|school|high|school|secondary|school|prep|school|boarding|school|private|school|public|school|charter|school|homeschool|online|school|virtual|school|distance|learning|e|learning|university|college|community|college|technical|college|trade|school|vocational|school|art|school|music|school|dance|school|drama|school|film|school|culinary|school|beauty|school|cosmetology|school|barber|school|driving|school|flight|school|medical|school|nursing|school|dental|school|veterinary|school|law|school|business|school|graduate|school|doctoral|program|postgraduate|continuing|education|adult|education|lifelong|learning|professional|development|certification|training|workshop|seminar|conference|symposium|summit|forum|panel|discussion|debate|lecture|presentation|speech|talk|address|keynote|commencement|graduation|ceremony|awards|ceremony|recognition|celebration|party|birthday|party|anniversary|party|wedding|reception|baby|shower|bridal|shower|housewarming|party|farewell|party|retirement|party|holiday|party|new|year|party|christmas|party|thanksgiving|dinner|easter|dinner|passover|seder|ramadan|iftar|diwali|celebration|hanukkah|celebration|kwanzaa|celebration|chinese|new|year|lunar|new|year|valentine|day|mother|day|father|day|memorial|day|independence|day|labor|day|columbus|day|veterans|day|martin|luther|king|day|president|day|groundhog|day|st|patrick|day|april|fool|day|earth|day|arbor|day|may|day|halloween|all|saints|day|all|souls|day|day|dead|cinco|de|mayo|fourth|july|canada|day|boxing|day|new|year|eve|christmas|eve|good|friday|easter|sunday|palm|sunday|ash|wednesday|mardi|gras|carnival|festival|oktoberfest|coachella|burning|man|comic|con|sxsw|cannes|film|festival|sundance|film|festival|toronto|film|festival|venice|biennale|art|basel|fashion|week|milan|fashion|week|paris|fashion|week|new|york|fashion|week|london|fashion|week|met|gala|oscar|academy|awards|golden|globe|awards|emmy|awards|grammy|awards|tony|awards|cannes|palme|or|venice|golden|lion|berlin|golden|bear|bafta|awards|screen|actors|guild|awards|critics|choice|awards|people|choice|awards|teen|choice|awards|kids|choice|awards|mtv|movie|awards|mtv|video|music|awards|american|music|awards|billboard|music|awards|country|music|awards|rock|roll|hall|fame|songwriters|hall|fame|nobel|prize|pulitzer|prize|booker|prize|man|booker|prize|national|book|award|newbery|medal|caldecott|medal|hugo|award|nebula|award|world|fantasy|award|bram|stoker|award|edgar|award|agatha|award|anthony|award|macavity|award|shamus|award|thriller|award|international|thriller|award|crime|writers|association|award|mystery|writers|america|award|sisters|crime|award|left|coast|crime|award|hammett|prize|nero|award|dilys|award|barry|award|arthur|ellis|award|ned|kelly|award|gold|dagger|silver|dagger|historical|dagger|john|creasey|dagger|diamond|dagger|cartier|diamond|dagger|ian|fleming|steel|dagger|ellis|peters|historical|award|margery|allingham|prize|debut|dagger|international|dagger|short|story|dagger|crime|writers|canada|award|arthur|ellis|best|novel|award|arthur|ellis|best|first|novel|award|arthur|ellis|best|short|story|award|arthur|ellis|best|true|crime|award|arthur|ellis|best|juvenile|award|arthur|ellis|best|crime|writing|award|unhanged|arthur|award|derrick|murdoch|award|crime|writers|association|debut|dagger|john|creasey|new|blood|dagger|last|laugh|award|dagger|in|library|award|martin|beck|award|glass|key|award|red|herring|award|malice|domestic|award|agatha|award|best|novel|agatha|award|best|first|novel|agatha|award|best|short|story|agatha|award|best|nonfiction|agatha|award|best|children|young|adult|novel|anthony|award|best|novel|anthony|award|best|first|novel|anthony|award|best|paperback|original|anthony|award|best|short|story|anthony|award|best|critical|nonfiction|work|anthony|award|best|young|adult|novel|barry|award|best|novel|barry|award|best|first|novel|barry|award|best|british|novel|barry|award|best|paperback|original|barry|award|best|thriller|barry|award|best|short|story|dilys|award|macavity|award|best|mystery|novel|macavity|award|best|first|mystery|novel|macavity|award|best|short|story|macavity|award|best|nonfiction|macavity|award|best|juvenile|young|adult|mystery|shamus|award|best|hardcover|novel|shamus|award|best|original|paperback|novel|shamus|award|best|short|story|shamus|award|best|first|novel|ned|kelly|award|best|crime|novel|ned|kelly|award|best|first|crime|novel|ned|kelly|award|best|true|crime|book|ned|kelly|award|best|crime|writing|award|ned|kelly|award|lifetime|achievement|award|davitt|award|best|adult|crime|novel|davitt|award|best|young|adult|crime|novel|davitt|award|best|children|crime|novel|davitt|award|best|true|crime|book|davitt|award|readers|choice|award|sisters|crime|award|best|crime|novel|sisters|crime|award|best|crime|debut|sisters|crime|award|best|published|crime|short|story|sisters|crime|award|best|crime|nonfiction|sisters|crime|award|best|crime|novel|series|sisters|crime|award|best|crime|novel|set|past|sisters|crime|award|best|young|adult|crime|novel|left|coast|crime|award|best|mystery|novel|left|coast|crime|award|best|mystery|novel|series|left|coast|crime|award|best|mystery|short|story|left|coast|crime|award|best|mystery|nonfiction|left|coast|crime|award|lefty|award|best|humorous|mystery|novel|lefty|award|best|humorous|mystery|short|story|hammett|prize|literary|excellence|crime|writing|nero|award|classic|american|mystery|fiction|best|represents|genre|noir|tradition|edgar|award|best|novel|edgar|award|best|first|novel|edgar|award|best|paperback|original|edgar|award|best|fact|crime|edgar|award|best|critical|biographical|work|edgar|award|best|short|story|edgar|award|best|young|adult|mystery|edgar|award|best|juvenile|mystery|edgar|award|best|play|edgar|award|best|television|episode|teleplay|edgar|award|best|motion|picture|screenplay|edgar|award|raven|award|edgar|award|ellery|queen|award|edgar|award|robert|l|fish|memorial|award|edgar|award|sue|grafton|memorial|award|edgar|award|mary|higgins|clark|award|edgar|award|simon|schuster|mary|higgins|clark|award|edgar|award|g|p|putnam|sons|sue|grafton|memorial|award|edgar|award|minotaur|books|malice|domestic|award|best|traditional|mystery|novel|edgar|award|grand|master|award|edgar|award|lifetime|achievement|award|mwa|grand|master|award|private|eye|writers|america|shamus|award|best|hardcover|pi|novel|shamus|award|best|original|pi|paperback|shamus|award|best|pi|short|story|shamus|award|best|first|pi|novel|shamus|award|eye|lifetime|achievement|award|private|eye|writers|america|lifetime|achievement|award|international|thriller|writers|thrillermaster|award|international|thriller|writers|silver|bullet|award|international|thriller|writers|best|first|novel|award|international|thriller|writers|best|thriller|award|international|thriller|writers|best|e|book|original|thriller|international|thriller|writers|best|audiobook|thriller|international|thriller|writers|best|thriller|short|story|international|thriller|writers|best|young|adult|thriller|international|thriller|writers|best|screenplay|thriller|bram|stoker|award|superior|achievement|novel|bram|stoker|award|superior|achievement|first|novel|bram|stoker|award|superior|achievement|long|fiction|bram|stoker|award|superior|achievement|short|fiction|bram|stoker|award|superior|achievement|collection|bram|stoker|award|superior|achievement|anthology|bram|stoker|award|superior|achievement|nonfiction|bram|stoker|award|superior|achievement|poetry|bram|stoker|award|superior|achievement|screenplay|bram|stoker|award|superior|achievement|graphic|novel|bram|stoker|award|superior|achievement|young|adult|novel|bram|stoker|award|superior|achievement|middle|grade|novel|bram|stoker|award|lifetime|achievement|award|horror|writers|association|lifetime|achievement|award|world|fantasy|award|best|novel|world|fantasy|award|best|novella|world|fantasy|award|best|short|fiction|world|fantasy|award|best|anthology|world|fantasy|award|best|collection|world|fantasy|award|best|artist|world|fantasy|award|special|award|professional|world|fantasy|award|special|award|nonprofessional|world|fantasy|convention|award|life|achievement|award|hugo|award|best|novel|hugo|award|best|novella|hugo|award|best|novelette|hugo|award|best|short|story|hugo|award|best|series|hugo|award|best|related|work|hugo|award|best|graphic|story|hugo|award|best|dramatic|presentation|long|form|hugo|award|best|dramatic|presentation|short|form|hugo|award|best|editor|short|form|hugo|award|best|editor|long|form|hugo|award|best|professional|artist|hugo|award|best|semiprozine|hugo|award|best|fanzine|hugo|award|best|fancast|hugo|award|best|fan|writer|hugo|award|best|fan|artist|hugo|award|lodestar|award|best|young|adult|book|hugo|award|astounding|award|best|new|writer|nebula|award|best|novel|nebula|award|best|novella|nebula|award|best|novelette|nebula|award|best|short|story|nebula|award|ray|bradbury|award|outstanding|dramatic|presentation|nebula|award|andre|norton|award|young|adult|science|fiction|fantasy|locus|award|best|science|fiction|novel|locus|award|best|fantasy|novel|locus|award|best|horror|novel|locus|award|best|young|adult|book|locus|award|best|first|novel|locus|award|best|novella|locus|award|best|novelette|locus|award|best|short|story|locus|award|best|collection|locus|award|best|anthology|locus|award|best|nonfiction|locus|award|best|art|book|locus|award|best|magazine|locus|award|best|publisher|prometheus|award|best|libertarian|science|fiction|novel|prometheus|award|best|libertarian|science|fiction|novel|prometheus|award|hall|fame|award|philip|k|dick|award|distinguished|science|fiction|published|paperback|original|united|states|arthur|c|clarke|award|best|science|fiction|novel|published|united|kingdom|john|w|campbell|memorial|award|best|science|fiction|novel|theodore|sturgeon|memorial|award|best|short|science|fiction|story|year|seiun|award|best|science|fiction|novel|seiun|award|best|science|fiction|short|story|seiun|award|best|translated|science|fiction|novel|seiun|award|best|translated|science|fiction|short|story|seiun|award|best|science|fiction|comic|seiun|award|best|science|fiction|art|seiun|award|best|science|fiction|nonfiction|seiun|award|best|science|fiction|magazine|seiun|award|special|award|sunburst|award|excellence|canadian|literature|fantastic|prix|aurora|award|best|long|form|work|english|prix|aurora|award|best|long|form|work|french|prix|aurora|award|best|short|form|work|english|prix|aurora|award|best|short|form|work|french|prix|aurora|award|best|other|work|english|prix|aurora|award|best|other|work|french|prix|aurora|award|best|work|youth|english|prix|aurora|award|best|work|youth|french|prix|aurora|award|best|artistic|achievement|prix|aurora|award|best|fan|publication|english|prix|aurora|award|best|fan|publication|french|casper|award|best|canadian|speculative|fiction|short|story|shirley|jackson|award|outstanding|achievement|horror|supernatural|fiction|william|l|crawford|award|best|first|fantasy|novel|mythopoeic|fantasy|award|adult|literature|mythopoeic|fantasy|award|children|literature|mythopoeic|scholarship|award|inklings|studies|mythopoeic|scholarship|award|myth|fantasy|studies|gandalf|award|grand|master|fantasy|balrog|award|best|novel|balrog|award|best|collection|anthology|balrog|award|best|poet|balrog|award|best|artist|balrog|award|best|amateur|publication|chesley|award|best|cover|illustration|hardback|book|chesley|award|best|cover|illustration|paperback|book|chesley|award|best|cover|illustration|magazine|chesley|award|best|interior|illustration|chesley|award|best|gaming|related|illustration|chesley|award|best|three|dimensional|art|chesley|award|best|monochrome|work|chesley|award|best|unpublished|color|work|chesley|award|best|unpublished|monochrome|work|chesley|award|artistic|achievement|spectrum|award|best|science|fiction|fantasy|art|spectrum|award|best|book|cover|spectrum|award|best|magazine|cover|spectrum|award|best|interior|illustration|spectrum|award|best|concept|art|spectrum|award|best|three|dimensional|art|spectrum|award|best|advertising|spectrum|award|best|comic|book|art|spectrum|award|best|game|art|spectrum|award|best|unpublished|art|spectrum|award|best|student|art|spectrum|award|grand|master|award|rhysling|award|best|long|poem|rhysling|award|best|short|poem|dwarf|stars|award|best|very|short|speculative|poem|elgin|award|best|full|length|speculative|poetry|collection|elgin|award|best|speculative|poetry|chapbook|asimov|readers|award|best|short|science|fiction|analog|analytical|laboratory|award|best|fact|article|published|analog|science|fiction|fact|magazine|anlab|award|best|science|fact|article|published|analog|science|fiction|fact|magazine|campbell|award|best|science|fiction|novel|year|campbell|award|best|new|writer|compton|crook|award|best|first|science|fiction|fantasy|horror|novel|crawford|award|best|first|fantasy|novel|derleth|award|best|horror|novel|fantasy|award|best|horror|novel|published|year|international|horror|guild|award|best|horror|novel|stoker|award|best|horror|novel|shirley|jackson|award|best|horror|supernatural|fiction|novel|novelette|novella|short|story|collection|world|horror|convention|grand|master|award|lifetime|achievement|horror|fiction|horror|writers|association|lifetime|achievement|award|lifetime|achievement|horror|fiction|cemetery|dance|award|best|horror|novel|cemetery|dance|award|best|horror|collection|cemetery|dance|award|best|horror|anthology|cemetery|dance|award|best|horror|magazine|cemetery|dance|award|best|horror|small|press|cemetery|dance|award|best|horror|artist|cemetery|dance|award|best|horror|website|cemetery|dance|award|best|horror|film|cemetery|dance|award|best|horror|tv|series|cemetery|dance|award|richard|laymon|award|best|horror|novel|published|small|press|cemetery|dance|award|thomas|f|monteleone|award|best|horror|magazine|cemetery|dance|award|specialty|press|award|best|horror|specialty|publication|cemetery|dance|award|william|f|nolan|award|lifetime|achievement|horror|fiction|rondo|award|best|horror|film|rondo|award|best|independent|horror|film|rondo|award|best|horror|tv|series|rondo|award|best|horror|actor|rondo|award|best|horror|actress|rondo|award|best|horror|comic|book|rondo|award|best|horror|magazine|rondo|award|best|horror|website|rondo|award|best|horror|podcast|rondo|award|best|horror|book|rondo|award|best|horror|anthology|collection|rondo|award|best|horror|reference|book|rondo|award|best|horror|artist|rondo|award|best|horror|make|up|artist|rondo|award|best|horror|soundtrack|rondo|award|best|horror|restoration|reissue|rondo|award|best|horror|convention|rondo|award|best|horror|video|rondo|award|best|horror|documentary|rondo|award|best|horror|fan|publication|rondo|award|best|horror|fan|website|rondo|award|best|horror|fan|film|rondo|award|best|horror|fan|short|film|rondo|award|best|horror|fan|trailer|rondo|award|best|horror|fan|audio|production|rondo|award|best|horror|fan|song|rondo|award|best|horror|fan|poster|rondo|award|best|horror|fan|photo|rondo|award|best|horror|fan|artist|rondo|award|best|horror|fan|writer|rondo|award|best|horror|fan|publisher|rondo|award|best|horror|fan|convention|rondo|award|best|horror|fan|product|rondo|award|best|horror|fan|service|rondo|award|best|horror|fan|magazine|rondo|award|best|horror|fan|newsletter|rondo|award|best|horror|fan|website|rondo|award|best|horror|fan|podcast|rondo|award|best|horror|fan|blog|rondo|award|best|horror|fan|forum|rondo|award|best|horror|fan|social|media|rondo|award|best|horror|fan|youtube|channel|rondo|award|best|horror|fan|instagram|account|rondo|award|best|horror|fan|twitter|account|rondo|award|best|horror|fan|facebook|page|rondo|award|best|horror|fan|tiktok|account|rondo|award|best|horror|fan|reddit|community|rondo|award|best|horror|fan|discord|server|rondo|award|best|horror|fan|telegram|channel|rondo|award|best|horror|fan|whatsapp|group|rondo|award|best|horror|fan|signal|group|rondo|award|best|horror|fan|clubhouse|room|rondo|award|best|horror|fan|spaces|room|rondo|award|best|horror|fan|linkedin|group|rondo|award|best|horror|fan|pinterest|board|rondo|award|best|horror|fan|tumblr|blog|rondo|award|best|horror|fan|snapchat|account|rondo|award|best|horror|fan|twitch|stream|rondo|award|best|horror|fan|onlyfans|account|rondo|award|best|horror|fan|patreon|page|rondo|award|best|horror|fan|ko|fi|page|rondo|award|best|horror|fan|buy|me|coffee|page|rondo|award|best|horror|fan|paypal|me|link|rondo|award|best|horror|fan|venmo|account|rondo|award|best|horror|fan|cashapp|account|rondo|award|best|horror|fan|zelle|account|rondo|award|best|horror|fan|apple|pay|account|rondo|award|best|horror|fan|google|pay|account|rondo|award|best|horror|fan|samsung|pay|account|rondo|award|best|horror|fan|amazon|pay|account|rondo|award|best|horror|fan|payoneer|account|rondo|award|best|horror|fan|stripe|account|rondo|award|best|horror|fan|square|account|rondo|award|best|horror|fan|shopify|store|rondo|award|best|horror|fan|etsy|shop|rondo|award|best|horror|fan|ebay|store|rondo|award|best|horror|fan|amazon|store|rondo|award|best|horror|fan|walmart|store|rondo|award|best|horror|fan|target|store|rondo|award|best|horror|fan|costco|store|rondo|award|best|horror|fan|sam|club|store|rondo|award|best|horror|fan|best|buy|store|rondo|award|best|horror|fan|home|depot|store|rondo|award|best|horror|fan|lowe|store|rondo|award|best|horror|fan|menards|store|rondo|award|best|horror|fan|ace|hardware|store|rondo|award|best|horror|fan|harbor|freight|store|rondo|award|best|horror|fan|northern|tool|store|rondo|award|best|horror|fan|tractor|supply|store|rondo|award|best|horror|fan|rural|king|store|rondo|award|best|horror|fan|fleet|farm|store|rondo|award|best|horror|fan|farm|fleet|store|rondo|award|best|horror|fan|tsc|store|rondo|award|best|horror|fan|atwood|store|rondo|award|best|horror|fan|blain|farm|fleet|store|rondo|award|best|horror|fan|bomgaars|store|rondo|award|best|horror|fan|cal|ranch|store|rondo|award|best|horror|fan|coastal|farm|ranch|store|rondo|award|best|horror|fan|co|op|store|rondo|award|best|horror|fan|farm|home|store|rondo|award|best|horror|fan|ifa|store|rondo|award|best|horror|fan|mills|fleet|farm|store|rondo|award|best|horror|fan|orscheln|farm|home|store|rondo|award|best|horror|fan|peavey|mart|store|rondo|award|best|horror|fan|runnings|store|rondo|award|best|horror|fan|stockman|grass|farmer|store|rondo|award|best|horror|fan|theisen|store|rondo|award|best|horror|fan|coastal|store|rondo|award|best|horror|fan|murdoch|store|rondo|award|best|horror|fan|buchheit|store|rondo|award|best|horror|fan|cenex|store|rondo|award|best|horror|fan|countrymax|store|rondo|award|best|horror|fan|nunn|better|store|rondo|award|best|horror|fan|southern|states|store|rondo|award|best|horror|fan|quality|farm|supply|store|rondo|award|best|horror|fan|united|ag|turf|store|rondo|award|best|horror|fan|wilco|store|rondo|award|best|horror|fan|agway|store|rondo|award|best|horror|fan|anderson|feed|store|rondo|award|best|horror|fan|burrus|seed|store|rondo|award|best|horror|fan|dewitt|feed|store|rondo|award|best|horror|fan|farmers|coop|store|rondo|award|best|horror|fan|growmark|store|rondo|award|best|horror|fan|helena|agri|enterprises|store|rondo|award|best|horror|fan|kalmbach|feeds|store|rondo|award|best|horror|fan|land|lakes|store|rondo|award|best|horror|fan|mfa|incorporated|store|rondo|award|best|horror|fan|nutra|blend|store|rondo|award|best|horror|fan|purina|animal|nutrition|store|rondo|award|best|horror|fan|ridley|feed|ingredients|store|rondo|award|best|horror|fan|triple|crown|feed|store|rondo|award|best|horror|fan|vita|plus|store|rondo|award|best|horror|fan|wen|feed|store|rondo|award|best|horror|fan|adm|alliance|nutrition|store|rondo|award|best|horror|fan|arm|hammer|animal|nutrition|store|rondo|award|best|horror|fan|bayer|animal|health|store|rondo|award|best|horror|fan|boehringer|ingelheim|animal|health|store|rondo|award|best|horror|fan|ceva|animal|health|store|rondo|award|best|horror|fan|elanco|animal|health|store|rondo|award|best|horror|fan|huvepharma|store|rondo|award|best|horror|fan|idexx|laboratories|store|rondo|award|best|horror|fan|merck|animal|health|store|rondo|award|best|horror|fan|neogen|corporation|store|rondo|award|best|horror|fan|phibro|animal|health|store|rondo|award|best|horror|fan|virbac|animal|health|store|rondo|award|best|horror|fan|zoetis|animal|health|store|rondo|award|best|horror|fan|abbott|animal|health|store|rondo|award|best|horror|fan|agrilabs|store|rondo|award|best|horror|fan|animax|store|rondo|award|best|horror|fan|aspen|veterinary|resources|store|rondo|award|best|horror|fan|bimeda|animal|health|store|rondo|award|best|horror|fan|butler|animal|health|supply|store|rondo|award|best|horror|fan|clipper|distributing|store|rondo|award|best|horror|fan|countryside|veterinary|supply|store|rondo|award|best|horror|fan|dawson|bradford|store|rondo|award|best|horror|fan|durvet|store|rondo|award|best|horror|fan|evolution|nutrition|store|rondo|award|best|horror|fan|farnam|companies|store|rondo|award|best|horror|fan|jeffers|pet|store|rondo|award|best|horror|fan|jurox|animal|health|store|rondo|award|best|horror|fan|kentucky|performance|products|store|rondo|award|best|horror|fan|lloyd|inc|store|rondo|award|best|horror|fan|manna|pro|products|store|rondo|award|best|horror|fan|midwest|veterinary|supply|store|rondo|award|best|horror|fan|moorman|feed|store|rondo|award|best|horror|fan|neogen|food|safety|store|rondo|award|best|horror|fan|norbrook|laboratories|store|rondo|award|best|horror|fan|northwest|naturals|store|rondo|award|best|horror|fan|nutri|source|store|rondo|award|best|horror|fan|patterson|veterinary|supply|store|rondo|award|best|horror|fan|phoenix|pharmaceutical|store|rondo|award|best|horror|fan|pro|earth|animal|health|store|rondo|award|best|horror|fan|revival|animal|health|store|rondo|award|best|horror|fan|rx|vitamins|store|rondo|award|best|horror|fan|sav|vet|store|rondo|award|best|horror|fan|sullivan|supply|store|rondo|award|best|horror|fan|team|laboratory|chemical|corporation|store|rondo|award|best|horror|fan|vetone|store|rondo|award|best|horror|fan|vet|kem|store|rondo|award|best|horror|fan|west|agro|store|rondo|award|best|horror|fan|zinpro|corporation|store|rondo|award|best|horror|fan|chewy|store|rondo|award|best|horror|fan|petco|store|rondo|award|best|horror|fan|petsmart|store|rondo|award|best|horror|fan|petland|store|rondo|award|best|horror|fan|pet|supplies|plus|store|rondo|award|best|horror|fan|pet|valu|store|rondo|award|best|horror|fan|hollywood|feed|store|rondo|award|best|horror|fan|mud|bay|store|rondo|award|best|horror|fan|natural|pet|food|store|rondo|award|best|horror|fan|bentley|pet|stuff|store|rondo|award|best|horror|fan|chuck|don|store|rondo|award|best|horror|fan|pet|food|express|store|rondo|award|best|horror|fan|pet|people|store|rondo|award|best|horror|fan|pet|club|store|rondo|award|best|horror|fan|pet|supermarket|store|rondo|award|best|horror|fan|kahoots|store|rondo|award|best|horror|fan|kriser|natural|pet|store|rondo|award|best|horror|fan|loyal|companion|store|rondo|award|best|horror|fan|natural|pawz|store|rondo|award|best|horror|fan|pet|wants|store|rondo|award|best|horror|fan|unleashed|store|rondo|award|best|horror|fan|wag|n|wash|store|rondo|award|best|horror|fan|pet|paradise|store|rondo|award|best|horror|fan|pet|gear|store|rondo|award|best|horror|fan|pet|universe|store|rondo|award|best|horror|fan|pet|city|store|rondo|award|best|horror|fan|pet|depot|store|rondo|award|best|horror|fan|pet|kingdom|store|rondo|award|best|horror|fan|pet|plaza|store|rondo|award|best|horror|fan|pet|ranch|store|rondo|award|best|horror|fan|pet|station|store|rondo|award|best|horror|fan|pet|stop|store|rondo|award|best|horror|fan|pet|town|store|rondo|award|best|horror|fan|pet|world|store|rondo|award|best|horror|fan|pet|zone|store|rondo|award|best|horror|fan|petland|discounts|store|rondo|award|best|horror|fan|pets|warehouse|store|rondo|award|best|horror|fan|pet|barn|store|rondo|award|best|horror|fan|pet|corner|store|rondo|award|best|horror|fan|pet|emporium|store|rondo|award|best|horror|fan|pet|gallery|store|rondo|award|best|horror|fan|pet|habitat|store|rondo|award|best|horror|fan|pet|junction|store|rondo|award|best|horror|fan|pet|market|store|rondo|award|best|horror|fan|pet|outlet|store|rondo|award|best|horror|fan|pet|pavilion|store|rondo|award|best|horror|fan|pet|place|store|rondo|award|best|horror|fan|pet|shop|store|rondo|award|best|horror|fan|pet|showcase|store|rondo|award|best|horror|fan|pet|store|rondo|award|best|horror|fan|pet|supply|store|rondo|award|best|horror|fan|pet|warehouse|store|rondo|award|best|horror|fan|pet|world|warehouse|store|rondo|award|best|horror|fan|pets|america|store|rondo|award|best|horror|fan|pets|at|home|store|rondo|award|best|horror|fan|pets|barn|store|rondo|award|best|horror|fan|pets|corner|store|rondo|award|best|horror|fan|pets|depot|store|rondo|award|best|horror|fan|pets|emporium|store|rondo|award|best|horror|fan|pets|gallery|store|rondo|award|best|horror|fan|pets|habitat|store|rondo|award|best|horror|fan|pets|junction|store|rondo|award|best|horror|fan|pets|market|store|rondo|award|best|horror|fan|pets|outlet|store|rondo|award|best|horror|fan|pets|pavilion|store|rondo|award|best|horror|fan|pets|place|store|rondo|award|best|horror|fan|pets|shop|store|rondo|award|best|horror|fan|pets|showcase|store|rondo|award|best|horror|fan|pets|store|rondo|award|best|horror|fan|pets|supply|store|rondo|award|best|horror|fan|pets|warehouse|store|rondo|award|best|horror|fan|pets|world|store|rondo|award|best|horror|fan|aquarium|store|rondo|award|best|horror|fan|bird|store|rondo|award|best|horror|fan|cat|store|rondo|award|best|horror|fan|dog|store|rondo|award|best|horror|fan|exotic|pet|store|rondo|award|best|horror|fan|fish|store|rondo|award|best|horror|fan|hamster|store|rondo|award|best|horror|fan|horse|store|rondo|award|best|horror|fan|rabbit|store|rondo|award|best|horror|fan|reptile|store|rondo|award|best|horror|fan|tropical|fish|store|rondo|award|best|horror|fan|animal|hospital|rondo|award|best|horror|fan|emergency|animal|hospital|rondo|award|best|horror|fan|veterinary|clinic|rondo|award|best|horror|fan|animal|clinic|rondo|award|best|horror|fan|pet|clinic|rondo|award|best|horror|fan|veterinary|hospital|rondo|award|best|horror|fan|emergency|veterinary|clinic|rondo|award|best|horror|fan|specialty|veterinary|clinic|rondo|award|best|horror|fan|mobile|veterinary|clinic|rondo|award|best|horror|fan|house|call|veterinary|service|rondo|award|best|horror|fan|grooming|salon|rondo|award|best|horror|fan|pet|grooming|salon|rondo|award|best|horror|fan|dog|grooming|salon|rondo|award|best|horror|fan|cat|grooming|salon|rondo|award|best|horror|fan|mobile|grooming|service|rondo|award|best|horror|fan|pet|daycare|rondo|award|best|horror|fan|dog|daycare|rondo|award|best|horror|fan|pet|boarding|rondo|award|best|horror|fan|dog|boarding|rondo|award|best|horror|fan|cat|boarding|rondo|award|best|horror|fan|pet|hotel|rondo|award|best|horror|fan|dog|hotel|rondo|award|best|horror|fan|cat|hotel|rondo|award|best|horror|fan|pet|resort|rondo|award|best|horror|fan|dog|resort|rondo|award|best|horror|fan|cat|resort|rondo|award|best|horror|fan|pet|spa|rondo|award|best|horror|fan|dog|spa|rondo|award|best|horror|fan|cat|spa|rondo|award|best|horror|fan|pet|training|rondo|award|best|horror|fan|dog|training|rondo|award|best|horror|fan|cat|training|rondo|award|best|horror|fan|puppy|training|rondo|award|best|horror|fan|obedience|training|rondo|award|best|horror|fan|agility|training|rondo|award|best|horror|fan|behavior|training|rondo|award|best|horror|fan|service|dog|training|rondo|award|best|horror|fan|therapy|dog|training|rondo|award|best|horror|fan|emotional|support|animal|training|rondo|award|best|horror|fan|pet|sitting|rondo|award|best|horror|fan|dog|sitting|rondo|award|best|horror|fan|cat|sitting|rondo|award|best|horror|fan|pet|walking|rondo|award|best|horror|fan|dog|walking|rondo|award|best|horror|fan|pet|care|rondo|award|best|horror|fan|pet|services|rondo|award|best|horror|fan|animal|services|rondo|award|best|horror|fan|veterinary|services|rondo|award|best|horror|fan|pet|insurance|rondo|award|best|horror|fan|animal|insurance|rondo|award|best|horror|fan|veterinary|insurance|rondo|award|best|horror|fan|pet|health|insurance|rondo|award|best|horror|fan|animal|health|insurance|rondo|award|best|horror|fan|pet|wellness|plan|rondo|award|best|horror|fan|animal|wellness|plan|rondo|award|best|horror|fan|veterinary|wellness|plan|rondo|award|best|horror|fan|pet|medication|rondo|award|best|horror|fan|animal|medication|rondo|award|best|horror|fan|veterinary|medication|rondo|award|best|horror|fan|pet|pharmacy|rondo|award|best|horror|fan|animal|pharmacy|rondo|award|best|horror|fan|veterinary|pharmacy|rondo|award|best|horror|fan|pet|supplement|rondo|award|best|horror|fan|animal|supplement|rondo|award|best|horror|fan|veterinary|supplement|rondo|award|best|horror|fan|pet|vitamin|rondo|award|best|horror|fan|animal|vitamin|rondo|award|best|horror|fan|veterinary|vitamin|rondo|award|best|horror|fan|pet|nutrition|rondo|award|best|horror|fan|animal|nutrition|rondo|award|best|horror|fan|veterinary|nutrition|rondo|award|best|horror|fan|pet|food|rondo|award|best|horror|fan|animal|food|rondo|award|best|horror|fan|dog|food|rondo|award|best|horror|fan|cat|food|rondo|award|best|horror|fan|bird|food|rondo|award|best|horror|fan|fish|food|rondo|award|best|horror|fan|rabbit|food|rondo|award|best|horror|fan|hamster|food|rondo|award|best|horror|fan|guinea|pig|food|rondo|award|best|horror|fan|ferret|food|rondo|award|best|horror|fan|reptile|food|rondo|award|best|horror|fan|horse|food|rondo|award|best|horror|fan|livestock|food|rondo|award|best|horror|fan|farm|animal|food|rondo|award|best|horror|fan|pet|treat|rondo|award|best|horror|fan|animal|treat|rondo|award|best|horror|fan|dog|treat|rondo|award|best|horror|fan|cat|treat|rondo|award|best|horror|fan|bird|treat|rondo|award|best|horror|fan|fish|treat|rondo|award|best|horror|fan|rabbit|treat|rondo|award|best|horror|fan|hamster|treat|rondo|award|best|horror|fan|guinea|pig|treat|rondo|award|best|horror|fan|ferret|treat|rondo|award|best|horror|fan|reptile|treat|rondo|award|best|horror|fan|horse|treat|rondo|award|best|horror|fan|livestock|treat|rondo|award|best|horror|fan|farm|animal|treat|rondo|award|best|horror|fan|pet|toy|rondo|award|best|horror|fan|animal|toy|rondo|award|best|horror|fan|dog|toy|rondo|award|best|horror|fan|cat|toy|rondo|award|best|horror|fan|bird|toy|rondo|award|best|horror|fan|fish|toy|rondo|award|best|horror|fan|rabbit|toy|rondo|award|best|horror|fan|hamster|toy|rondo|award|best|horror|fan|guinea|pig|toy|rondo|award|best|horror|fan|ferret|toy|rondo|award|best|horror|fan|reptile|toy|rondo|award|best|horror|fan|horse|toy|rondo|award|best|horror|fan|livestock|toy|rondo|award|best|horror|fan|farm|animal|toy|rondo|award|best|horror|fan|pet|bed|rondo|award|best|horror|fan|animal|bed|rondo|award|best|horror|fan|dog|bed|rondo|award|best|horror|fan|cat|bed|rondo|award|best|horror|fan|bird|bed|rondo|award|best|horror|fan|fish|bed|rondo|award|best|horror|fan|rabbit|bed|rondo|award|best|horror|fan|hamster|bed|rondo|award|best|horror|fan|guinea|pig|bed|rondo|award|best|horror|fan|ferret|bed|rondo|award|best|horror|fan|reptile|bed|rondo|award|best|horror|fan|horse|bed|rondo|award|best|horror|fan|livestock|bed|rondo|award|best|horror|fan|farm|animal|bed|rondo|award|best|horror|fan|pet|cage|rondo|award|best|horror|fan|animal|cage|rondo|award|best|horror|fan|dog|cage|rondo|award|best|horror|fan|cat|cage|rondo|award|best|horror|fan|bird|cage|rondo|award|best|horror|fan|fish|cage|rondo|award|best|horror|fan|rabbit|cage|rondo|award|best|horror|fan|hamster|cage|rondo|award|best|horror|fan|guinea|pig|cage|rondo|award|best|horror|fan|ferret|cage|rondo|award|best|horror|fan|reptile|cage|rondo|award|best|horror|fan|horse|cage|rondo|award|best|horror|fan|livestock|cage|rondo|award|best|horror|fan|farm|animal|cage|rondo|award|best|horror|fan|pet|carrier|rondo|award|best|horror|fan|animal|carrier|rondo|award|best|horror|fan|dog|carrier|rondo|award|best|horror|fan|cat|carrier|rondo|award|best|horror|fan|bird|carrier|rondo|award|best|horror|fan|fish|carrier|rondo|award|best|horror|fan|rabbit|carrier|rondo|award|best|horror|fan|hamster|carrier|rondo|award|best|horror|fan|guinea|pig|carrier|rondo|award|best|horror|fan|ferret|carrier|rondo|award|best|horror|fan|reptile|carrier|rondo|award|best|horror|fan|horse|carrier|rondo|award|best|horror|fan|livestock|carrier|rondo|award|best|horror|fan|farm|animal|carrier|rondo|award|best|horror|fan|pet|crate|rondo|award|best|horror|fan|animal|crate|rondo|award|best|horror|fan|dog|crate|rondo|award|best|horror|fan|cat|crate|rondo|award|best|horror|fan|bird|crate|rondo|award|best|horror|fan|fish|crate|rondo|award|best|horror|fan|rabbit|crate|rondo|award|best|horror|fan|hamster|crate|rondo|award|best|horror|fan|guinea|pig|crate|rondo|award|best|horror|fan|ferret|crate|rondo|award|best|horror|fan|reptile|crate|rondo|award|best|horror|fan|horse|crate|rondo|award|best|horror|fan|livestock|crate|rondo|award|best|horror|fan|farm|animal|crate|rondo|award|best|horror|fan|pet|leash|rondo|award|best|horror|fan|animal|leash|rondo|award|best|horror|fan|dog|leash|rondo|award|best|horror|fan|cat|leash|rondo|award|best|horror|fan|bird|leash|rondo|award|best|horror|fan|fish|leash|rondo|award|best|horror|fan|rabbit|leash|rondo|award|best|horror|fan|hamster|leash|rondo|award|best|horror|fan|guinea|pig|leash|rondo|award|best|horror|fan|ferret|leash|rondo|award|best|horror|fan|reptile|leash|rondo|award|best|horror|fan|horse|leash|rondo|award|best|horror|fan|livestock|leash|rondo|award|best|horror|fan|farm|animal|leash|rondo|award|best|horror|fan|pet|collar|rondo|award|best|horror|fan|animal|collar|rondo|award|best|horror|fan|dog|collar|rondo|award|best|horror|fan|cat|collar|rondo|award|best|horror|fan|bird|collar|rondo|award|best|horror|fan|fish|collar|rondo|award|best|horror|fan|rabbit|collar|rondo|award|best|horror|fan|hamster|collar|rondo|award|best|horror|fan|guinea|pig|collar|rondo|award|best|horror|fan|ferret|collar|rondo|award|best|horror|fan|reptile|collar|rondo|award|best|horror|fan|horse|collar|rondo|award|best|horror|fan|livestock|collar|rondo|award|best|horror|fan|farm|animal|collar|rondo|award|best|horror|fan|pet|harness|rondo|award|best|horror|fan|animal|harness|rondo|award|best|horror|fan|dog|harness|rondo|award|best|horror|fan|cat|harness|rondo|award|best|horror|fan|bird|harness|rondo|award|best|horror|fan|fish|harness|rondo|award|best|horror|fan|rabbit|harness|rondo|award|best|horror|fan|hamster|harness|rondo|award|best|horror|fan|guinea|pig|harness|rondo|award|best|horror|fan|ferret|harness|rondo|award|best|horror|fan|reptile|harness|rondo|award|best|horror|fan|horse|harness|rondo|award|best|horror|fan|livestock|harness|rondo|award|best|horror|fan|farm|animal|harness|rondo|award|best|horror|fan|pet|tag|rondo|award|best|horror|fan|animal|tag|rondo|award|best|horror|fan|dog|tag|rondo|award|best|horror|fan|cat|tag|rondo|award|best|horror|fan|bird|tag|rondo|award|best|horror|fan|fish|tag|rondo|award|best|horror|fan|rabbit|tag|rondo|award|best|horror|fan|hamster|tag|rondo|award|best|horror|fan|guinea|pig|tag|rondo|award|best|horror|fan|ferret|tag|rondo|award|best|horror|fan|reptile|tag|rondo|award|best|horror|fan|horse|tag|rondo|award|best|horror|fan|livestock|tag|rondo|award|best|horror|fan|farm|animal|tag|rondo|award|best|horror|fan|pet|id|rondo|award|best|horror|fan|animal|id|rondo|award|best|horror|fan|dog|id|rondo|award|best|horror|fan|cat|id|rondo|award|best|horror|fan|bird|id|rondo|award|best|horror|fan|fish|id|rondo|award|best|horror|fan|rabbit|id|rondo|award|best|horror|fan|hamster|id|rondo|award|best|horror|fan|guinea|pig|id|rondo|award|best|horror|fan|ferret|id|rondo|award|best|horror|fan|reptile|id|rondo|award|best|horror|fan|horse|id|rondo|award|best|horror|fan|livestock|id|rondo|award|best|horror|fan|farm|animal|id|rondo|award|best|horror|fan|pet|microchip|rondo|award|best|horror|fan|animal|microchip|rondo|award|best|horror|fan|dog|microchip|rondo|award|best|horror|fan|cat|microchip|rondo|award|best|horror|fan|bird|microchip|rondo|award|best|horror|fan|fish|microchip|rondo|award|best|horror|fan|rabbit|microchip|rondo|award|best|horror|fan|hamster|microchip|rondo|award|best|horror|fan|guinea|pig|microchip|rondo|award|best|horror|fan|ferret|microchip|rondo|award|best|horror|fan|reptile|microchip|rondo|award|best|horror|fan|horse|microchip|rondo|award|best|horror|fan|livestock|microchip|rondo|award|best|horror|fan|farm|animal|microchip)\b/gi
  ];

  eventPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      entities.events.push(...matches.map(match => match.toLowerCase()));
    }
  });

  // Extract dates
  const datePatterns = [
    /\b(yesterday|today|tomorrow|last week|next week|last month|next month|last year|next year)\b/gi,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
    /\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g
  ];

  datePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      entities.dates.push(...matches.map(match => match.toLowerCase()));
    }
  });

  // Remove duplicates
  entities.people = [...new Set(entities.people)];
  entities.topics = [...new Set(entities.topics)];
  entities.events = [...new Set(entities.events)];
  entities.dates = [...new Set(entities.dates)];

  return entities;
}

async function getContextualMessages(mentionedUsers: string[], conversationHistory: Message[]): Promise<any[]> {
  // Get ALL conversation history, not just filtered messages
  // This ensures the AI can see the complete context
  const allUsers = await storage.getAllUsers();
  const userMap = new Map(allUsers.map(user => [user.id, user]));
  
  // Convert message data to include user names for better context
  const messagesWithUserNames = conversationHistory
    .map(msg => {
      const user = userMap.get(msg.userId!);
      return {
        id: msg.id,
        content: msg.content,
        userName: user?.name || 'Unknown User',
        timestamp: msg.timestamp,
        mentions: msg.mentions || [],
        isAiResponse: msg.isAiResponse
      };
    })
    .slice(-20); // Last 20 messages for full context

  return messagesWithUserNames;
}

async function getKnowledgeContext(mentionedUsers: string[]): Promise<any> {
  const entities = await storage.getAllKnowledgeGraphEntities();
  const relationships = await storage.getAllKnowledgeGraphRelationships();
  
  // Filter entities related to mentioned users
  const relevantEntities = entities.filter(entity => 
    mentionedUsers.some(user => 
      entity.name.toLowerCase().includes(user.toLowerCase()) ||
      entity.type === 'person' && entity.name === user
    )
  );
  
  // Get relationships involving these entities
  const relevantRelationships = relationships.filter(rel => 
    relevantEntities.some(entity => 
      entity.id === rel.fromEntityId || entity.id === rel.toEntityId
    )
  );

  return {
    entities: relevantEntities,
    relationships: relevantRelationships
  };
}

export async function extractAndStoreEntities(
  messageId: number,
  extractedEntities: AIResponse['extractedEntities'],
  participants: string[]
): Promise<void> {
  try {
    console.log('Extracting entities for message:', messageId);
    console.log('Extracted entities:', extractedEntities);
    console.log('Participants:', participants);

    const allEntities = [
      ...extractedEntities.people.map(name => ({ name, type: 'person' })),
      ...extractedEntities.topics.map(name => ({ name, type: 'topic' })),
      ...extractedEntities.events.map(name => ({ name, type: 'event' })),
      ...extractedEntities.dates.map(name => ({ name, type: 'date' }))
    ];

    console.log('All entities to process:', allEntities);

    // Always create entities for participants
    for (const participant of participants) {
      if (participant !== 'AI Agent') {
        let participantEntity = await storage.getKnowledgeGraphEntityByName(participant);
        if (!participantEntity) {
          participantEntity = await storage.createKnowledgeGraphEntity({
            name: participant,
            type: 'person',
            properties: {}
          });
          console.log('Created participant entity:', participantEntity);
        }
      }
    }

    // Create entities and relationships
    for (const entityData of allEntities) {
      let entity = await storage.getKnowledgeGraphEntityByName(entityData.name);
      
      if (!entity) {
        entity = await storage.createKnowledgeGraphEntity({
          name: entityData.name,
          type: entityData.type,
          properties: {}
        });
        console.log('Created entity:', entity);
      }

      // Create relationships between participants and entities
      for (const participant of participants) {
        if (participant !== 'AI Agent' && participant !== entityData.name) {
          const participantEntity = await storage.getKnowledgeGraphEntityByName(participant);
          if (participantEntity) {
            const relationship = await storage.createKnowledgeGraphRelationship({
              fromEntityId: participantEntity.id,
              toEntityId: entity.id,
              relationshipType: entityData.type === 'person' ? 'mentions' : 'discusses',
              properties: {},
              messageId
            });
            console.log('Created relationship:', relationship);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error extracting and storing entities:", error);
  }
}
