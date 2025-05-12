# test_not_translator.py
from processor.translators.not_translator import NotTranslator
from config import AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT

def test_not_translator():
    translator = NotTranslator(api_key=AZURE_OPENAI_API_KEY, endpoint=AZURE_OPENAI_ENDPOINT)
    test_texts = [
        "They aren't coming to the party tonight.",
        "I don't want to go.",
        "She can't find her keys.",
        "It will not work."
    ]
    
    for text in test_texts:
        print(f"\n=== Testing: '{text}' ===")
        contains_negation = translator.contains_negation(text)
        print(f"Contains negation: {contains_negation}")
        
        if contains_negation:
            result = translator.translate(text)
            print(f"Translation result: '{result}'")
        else:
            print("Skipped translation (no negation detected)")

if __name__ == "__main__":
    test_not_translator()