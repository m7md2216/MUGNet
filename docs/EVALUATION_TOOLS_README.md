# 🧪 Automated Evaluation Tools

Two Python tools to streamline your conversational memory research:

## 📥 Tool 1: Conversation Importer (`conversation_importer.py`)

**Purpose**: Import conversation scripts directly into your chat system

### How to Use:

1. **Create a conversation script file** with one of these formats:

```
Emma: Ugh, Monday again. I already miss the weekend.
Jake: Haha, same here. I'm struggling to focus on work.
Sarah: Tell me about it. I need more coffee.
Ryan: At least it's only 4 more days until Friday.
```

2. **Edit the script**: Change line 184 in `conversation_importer.py`:
```python
conversation_file = "your_conversation_script.txt"  # Put your file name here
```

3. **Run the importer**:
```bash
python conversation_importer.py
```

### Supported Formats:
- `Name: Message`
- `Day 1 - Name: Message` 
- `[Name] Message`
- `Name - Message`

### What It Does:
- Creates users automatically if they don't exist
- Imports all messages in the correct order
- Assigns messages to the right person
- Generates a detailed import log
- Shows progress and success rates

## 🎯 Tool 2: Question Evaluator (`question_evaluator.py`)

**Purpose**: Test the AI's knowledge with your questions and download results

### How to Use:

1. **Create a questions file** in CSV or TXT format:

**CSV Format (`questions.csv`)**:
```csv
Prompt,Memory Type,Ground Truth Answer
Who went camping?,Factual Recall,Jake
What does Emma like to eat?,Preference,Burritos with hot sauce
Which TV show did the group discuss?,Event Memory,Galactic Heist Chronicles
```

**TXT Format (`questions.txt`)**:
```
Q: Who went camping?
A: Jake

Q: What does Emma like to eat?
A: Burritos with hot sauce

Q: Which TV show did the group discuss?
A: Galactic Heist Chronicles
```

2. **Edit the script**: Change line 248 in `question_evaluator.py`:
```python
questions_file = "your_questions.csv"  # Put your file name here
```

3. **Run the evaluator**:
```bash
python question_evaluator.py
```

### What You Get:
- **JSON Report**: Detailed analysis with timestamps, success rates, and metadata
- **CSV File**: Easy-to-analyze spreadsheet with all responses
- **Progress Updates**: Live progress tracking during evaluation
- **Error Handling**: Automatic retries and timeout management

### Output Files:
- `question_evaluation_results_YYYYMMDD_HHMMSS.json`
- `question_evaluation_results_YYYYMMDD_HHMMSS.csv`

## 🔄 Complete Workflow

### Step 1: Import Conversations
1. Put your 1-10 day conversation script in a text file
2. Update `conversation_file` in `conversation_importer.py`
3. Run: `python conversation_importer.py`
4. Check the import log for success rate

### Step 2: Evaluate Knowledge
1. Create your evaluation questions (CSV or TXT)
2. Update `questions_file` in `question_evaluator.py`
3. Run: `python question_evaluator.py`
4. Download the generated CSV and JSON files

### Step 3: Analyze Results
- Open the CSV file in Excel/Google Sheets for easy analysis
- Use the JSON file for detailed technical analysis
- Compare ground truth vs AI responses
- Calculate accuracy metrics

## 📊 Example Results Structure

**CSV Output Columns:**
- Question Number
- Memory Type
- Question  
- Ground Truth
- AI Response
- Response Length
- Contains Error
- Timestamp

**JSON Report Includes:**
- Evaluation metadata (timestamps, success rates)
- Question breakdown by memory type
- Detailed results for each question
- Performance statistics

## 🚨 Important Notes

### Preventing Evaluation Contamination:
These tools help identify the contamination issue you discovered:
- The **importer** populates the knowledge graph from original conversations
- The **evaluator** tests what's actually in the graph
- Compare results to see extraction vs evaluation performance

### For Your IAAI Paper:
- Use the importer to establish baseline knowledge from conversations
- Use the evaluator to test original vs contaminated performance  
- The tools generate data you can directly cite in your research

### System Requirements:
- Chat system running on `localhost:5000`
- Python 3.7+ with `requests` library
- UTF-8 text file encoding

## 🛠 Troubleshooting

**Import Issues:**
- Check conversation format matches supported patterns
- Verify users are created correctly
- Review import log for parsing errors

**Evaluation Issues:**
- Ensure chat system is running
- Check API timeout settings (30 seconds default)
- Review error responses in output files

**File Format Issues:**
- Use UTF-8 encoding for international characters
- Check CSV delimiter (comma vs tab)
- Verify question/answer pairing in TXT format

These tools eliminate the manual work and provide consistent, repeatable evaluation data for your research.