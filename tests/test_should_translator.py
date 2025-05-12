import sys
import os
import json
from pprint import pprint

# Add the parent directory to the path to import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import necessary modules
from processor.translators.should_translator import ShouldTranslator
from database.db_manager import DatabaseManager

class TestDbManager:
    """Simple mock DB manager for testing"""
    def __init__(self, db_data):
        self.db_data = db_data
    
    def get_patterns(self, category):
        return self.db_data.get(category, {}).get("patterns", [])

def load_test_database():
    """Load the database from word_database.json"""
    try:
        with open("database/word_database.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print("Database file not found. Creating a mock database.")
        # Create a minimal mock database for testing
        return {
            "should_category": {
                "patterns": [
                    {
                        "pattern": "should",
                        "context_rules": [
                            {
                                "context_type": "high_optionality",
                                "indicators": ["suggestion", "idea", "consider"],
                                "replacement": "might"
                            },
                            {
                                "context_type": "moderate_optionality",
                                "indicators": ["recommend", "advise", "think"],
                                "replacement": "recommend"
                            },
                            {
                                "context_type": "low_optionality",
                                "indicators": ["important", "critical", "urgent"],
                                "replacement": "want you to"
                            }
                        ],
                        "default_replacement": "might"
                    },
                    {
                        "pattern": "could",
                        "default_replacement": "might"
                    },
                    {
                        "pattern": "would",
                        "default_replacement": "might"
                    },
                    {
                        "pattern": "shouldn't",
                        "default_replacement": "might reconsider"
                    },
                    {
                        "pattern": "couldn't",
                        "default_replacement": "struggled to"
                    },
                    {
                        "pattern": "wouldn't",
                        "default_replacement": "preferred to avoid"
                    },
                    {
                        "pattern": "we need to",
                        "default_replacement": "we must"
                    }
                ]
            }
        }

def run_translator_test(test_cases):
    """Run the ShouldTranslator on test cases and report results"""
    # Load database
    db_data = load_test_database()
    db_manager = TestDbManager(db_data)
    
    # Initialize translator
    translator = ShouldTranslator(db_manager)
    
    # Track test results
    results = []
    total_tests = len(test_cases)
    successful_tests = 0
    
    # Process each test case
    for i, test_case in enumerate(test_cases, 1):
        input_text = test_case["input"]
        expected_output = test_case["expected"]
        
        # Run translator
        translations, translated_text = translator.translate(input_text)
        
        # Check if output matches expected
        matches_expected = expected_output.lower() in translated_text.lower()
        success = "✅" if matches_expected else "❌"
        
        if matches_expected:
            successful_tests += 1
        
        # Store result
        results.append({
            "test_num": i,
            "input": input_text,
            "expected": expected_output,
            "actual": translated_text,
            "success": success,
            "translations": translations
        })
    
    # Return results and success rate
    return results, successful_tests / total_tests if total_tests > 0 else 0

def print_results(results, success_rate):
    """Print the test results in a readable format"""
    print("\n" + "=" * 80)
    print(f"SHOULD TRANSLATOR TEST RESULTS - Success Rate: {success_rate * 100:.2f}%")
    print("=" * 80)
    
    for result in results:
        print(f"\nTest #{result['test_num']}: {result['success']}")
        print(f"Input:    {result['input']}")
        print(f"Expected: {result['expected']}")
        print(f"Actual:   {result['actual']}")
        
        if result['success'] == "❌":
            print("\nTranslations found:")
            for t in result['translations']:
                print(f"  - '{t['original']}' → '{t['replacement']}'")
                print(f"    {t['explanation']}")
    
    print("\n" + "=" * 80)
    print(f"Total: {len(results)} tests, {sum(1 for r in results if r['success'] == '✅')} passed, {sum(1 for r in results if r['success'] == '❌')} failed")
    print("=" * 80)

def main():
    # Define test cases based on the provided dataset
    test_cases = [
        {
            "input": "You should try the new restaurant downtown.",
            "expected": "You might try the new restaurant downtown."
        },
        {
            "input": "I really think you should try the new restaurant downtown.",
            "expected": "I urge you to try the new restaurant downtown."
        },
        {
            "input": "This is very important, and you should try to get the work done today.",
            "expected": "This is very important, and I want you to try to get the work done today."
        },
        {
            "input": "We need to focus on rebuilding trust in leadership.",
            "expected": "We must focus on rebuilding trust in leadership."
        },
        {
            "input": "She could have finished earlier, but she got distracted.",
            "expected": "She might have finished earlier, but she got distracted."
        },
        {
            "input": "You shouldn't ignore the signs of declining employee morale.",
            "expected": "You might not ignore the signs of declining employee morale."
        },
        {
            "input": "He wouldn't compromise his values for short-term success.",
            "expected": "He preferred not to compromise his values for short-term success."
        },
        {
            "input": "We need to find new ways to foster collaboration.",
            "expected": "We must find new ways to foster collaboration."
        },
        {
            "input": "They should prioritize transparency to regain public confidence.",
            "expected": "They must prioritize transparency to regain public confidence."
        },
        {
            "input": "She wouldn't have believed it if she hadn't seen it herself.",
            "expected": "She might not have believed it if she hadn't seen it herself."
        },
        {
            "input": "You could take the risk, but weigh the consequences.",
            "expected": "You might take the risk, but weigh the consequences."
        },
        {
            "input": "We need to address misinformation before it spreads further.",
            "expected": "We must address misinformation before it spreads further."
        },
        {
            "input": "He couldn't understand why trust had eroded so quickly.",
            "expected": "He struggled to understand why trust had eroded so quickly."
        },
        {
            "input": "Would you be open to discussing alternative solutions?",
            "expected": "Would you be open to discussing alternative solutions?"
        },
        {
            "input": "We need to build stronger relationships with our clients.",
            "expected": "We must build stronger relationships with our clients."
        },
        {
            "input": "They shouldn't wait too long to make a decision.",
            "expected": "They must not wait too long to make a decision."
        },
        {
            "input": "She could see the hesitation in his eyes.",
            "expected": "She saw the hesitation in his eyes."
        },
        {
            "input": "We need to communicate our mission more clearly.",
            "expected": "We must communicate our mission more clearly."
        },
        {
            "input": "I wouldn't recommend launching the product without more testing.",
            "expected": "I recommend not launching the product without more testing."
        },
        {
            "input": "You should always follow through on your commitments.",
            "expected": "I recommend you always follow through on your commitments."
        }
    ]
    
    # Run tests
    results, success_rate = run_translator_test(test_cases)
    
    # Print results
    print_results(results, success_rate)

if __name__ == "__main__":
    main()