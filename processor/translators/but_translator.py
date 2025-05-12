import re
import os
import difflib
from processor.translators.azure_translator import AzureTranslator

class ButTranslator(AzureTranslator):
    def __init__(self, api_key=None, endpoint=None):
        """
        Initialize the ButTranslator with Azure OpenAI capabilities.
        
        Args:
            api_key (str, optional): API key for Azure OpenAI. Defaults to environment variable.
            endpoint (str, optional): Azure OpenAI endpoint. Defaults to environment variable.
        """
        super().__init__(api_key, endpoint)
        
        # Patterns to detect "but" and "yet" constructions
        self.but_patterns = [
            r'\bbut\b',
            r'\byet\b'
        ]
        
        # Comprehensive prompt based on the dataset, enhanced to include "yet"
        self.prompt_template = """
You are a specialized language transformation assistant that focuses on improving sentences containing the words "but" or "yet".

CRITICAL INSTRUCTION: Only transform the words "but" and "yet" themselves. Do not reword other parts of the sentence. Maintain exactly the same words for all parts of the sentence that don't contain "but" or "yet". Do not introduce new phrasing or synonyms for other words in the sentence.

CONTEXT:
The words "but" and "yet" often overemphasize what follows in a sentence, causing the receiver of the message to discount the ideas or content before these words and only focus on the ideas that follow. The goal is to replace them in most use cases with alternatives that give appropriate weight to both parts of the sentence.

FRICTION WORD LIST:
- but
- yet

RULES FOR REPLACEMENT:

1. When "but" or "yet" is used to introduce a contrast or contradiction:
   - Replace with "and at the same time"
   - Example: "She is smart, but she studies poorly" → "She is smart, and at the same time she studies poorly"
   - Example: "He wants to help, yet he lacks the resources" → "He wants to help, and at the same time he lacks the resources"

2. When "but" is used to indicate an exception to a statement:
   - Replace "but" with "except"
   - Example: "Everyone was invited, but John" → "Everyone was invited, except John"

3. When "but" or "yet" is used to clarify, soften, or make a point less harsh:
   - Replace with "and"
   - Example: "I like your idea, but I think we might consider other options" → "I like your idea, and I think we might consider other options"
   - Example: "The design is good, yet some improvements could be made" → "The design is good, and some improvements could be made"

4. When "but" is used in conjunction with "not" or "not only" to emphasize a point:
   IMPORTANT: For "not just X, but Y" or "not only X, but Y" constructions, DO NOT CHANGE THEM. These will be handled separately.
   
   For other cases:
   - Replace "but" with "and"
   - Example: "He isn't talented but hardworking" → "He is hardworking and talented"

WHEN TO LEAVE "BUT" OR "YET" UNCHANGED:
1. When used in informal speech to express surprise, objection, or disbelief:
   - Example: "But that's impossible!" (leave unchanged)
   - Example: "Yet how can this be?" (leave unchanged)

2. When "but" is used to mean "only" or "merely" to limit the scope of a statement:
   - Example: "He is but a child" (leave unchanged)

3. When "but" is functioning as a synonym for "except for":
   - Example: "No one but you can solve this problem" (leave unchanged)

4. When "yet" is used as an adverb meaning "up until now" or "so far":
   - Example: "I haven't finished the report yet" (leave unchanged)
   - Example: "Have they arrived yet?" (leave unchanged)

PROCESSING INSTRUCTIONS:
1. Find the exact occurrences of "but" or "yet" in the sentence.
2. Determine the function of each "but" or "yet" according to the rules above.
3. IMPORTANT: ONLY CHANGE THE WORDS "but" OR "yet" AND ESSENTIAL CONNECTING WORDS. DO NOT REWRITE THE ENTIRE SENTENCE.
4. DO NOT CHANGE WORDS LIKE "catastrophic" TO "challenging" OR "stumbling" TO "navigating" - PRESERVE THE ORIGINAL INTENSITY.
5. Return ONLY the transformed sentence without any explanations.

INPUT SENTENCE:
{text}

TRANSFORMED SENTENCE:
"""

    def is_not_just_but_construction(self, text):
        """
        Check if text contains 'not just/only...but' construction that needs special handling.
        Enhanced to detect various punctuation between the elements.
        
        Args:
            text (str): Text to check
            
        Returns:
            bool: True if special construction found, False otherwise
        """
        patterns = [
            # Standard patterns
            r'not\s+just\s+.+?\s+but\s+',
            r'not\s+only\s+.+?\s+but\s+',
            
            # Patterns with em dashes or hyphens
            r'not\s+just\s+.+?[-—]+\s*but\s+',
            r'not\s+only\s+.+?[-—]+\s*but\s+',
            r'becomes\s+not\s+just\s+.+?[-—]+\s*but\s+',
            
            # Multiple dash variations (---, —, --)
            r'not\s+just\s+.+?---\s*but\s+',
            r'not\s+just\s+.+?--\s*but\s+',
            r'not\s+just\s+.+?—\s*but\s+',
            
            # Patterns with specific prepositions
            r'not\s+just\s+for\s+.+?\s+but\s+for\s+',
            r'not\s+only\s+for\s+.+?\s+but\s+for\s+',
            
            # Additional patterns that may appear in content
            r'becomes\s+not\s+just\s+.+?\s+but\s+',
            r'becomes\s+not\s+only\s+.+?\s+but\s+',
            
            # Match pattern that ends sentences
            r'not\s+just\s+.+?\s+but\s+.+?\.$',
            r'not\s+only\s+.+?\s+but\s+.+?\.$'
        ]
        
        normalized_text = text.replace("'", "'").lower()
        
        for pattern in patterns:
            if re.search(pattern, normalized_text, re.IGNORECASE):
                print(f"✅ Special 'not just...but' construction detected using pattern: '{pattern}'")
                return True
                
        # Additional check for the specific phrase structures
        if ("not just" in normalized_text or "not only" in normalized_text) and "but" in normalized_text:
            print(f"✅ Special 'not just/only...but' construction detected through phrase check")
            return True
            
        return False

    def handle_not_just_but_construction(self, text):
        """
        Special handler for 'not just X, but Y' constructions.
        Transforms them to 'both X and Y' form or 'X and Y alike' form.
        Enhanced to handle em dashes and different punctuation patterns.
        
        Args:
            text (str): Text containing the construction
            
        Returns:
            str: Properly transformed text
        """
        # Format a specialized prompt for this construction
        prompt = """
You are a specialized language transformation assistant focusing on the "not just X, but Y" and "not only X, but Y" constructions.

CRITICAL INSTRUCTION: Your task is to transform sentences with "not just X, but Y" or "not only X, but Y" constructions into a form that preserves the exact meaning while removing the negative construction. Follow these specific rules carefully:

TRANSFORMATION RULES:
1. For "not only X but also Y" constructions:
   - Replace with "X and Y" or "X and also Y"
   - Example: "Not only did she finish the project ahead of schedule, but she also exceeded every expectation." → "She finished the project ahead of schedule, and she also exceeded every expectation."
   - Example: "He is not only a brilliant strategist but also a compassionate leader." → "He is a brilliant strategist and also a compassionate leader."

2. For "not just X, but Y" constructions:
   - Replace with "both X and Y" or similar phrasing
   - Example: "growth becomes not just possible---but sustainable" → "growth becomes both possible and sustainable"
   - Example: "And growth becomes not just possible—but sustainable." → "And growth becomes both possible and sustainable."

3. For phrases with em dashes or hyphens (---, —, --):
   - PRESERVE THE EXACT PUNCTUATION, but replace "not just...but" with appropriate phrasing
   - Example: "becomes not just possible---but sustainable" → "becomes both possible---and sustainable"
   - Example: "becomes not just possible—but sustainable" → "becomes both possible—and sustainable"

4. For constructions with "for" or similar prepositions:
   - Preserve the prepositions and convert to a list format
   - Example: "not just for your strategy, but for your culture" → "for your strategy and for your culture alike"
   - Example: "not just for strategy, but for culture, leadership, and legacy" → "for strategy, for culture, for leadership, and for legacy"

5. For lists with multiple items:
   - Convert to a simple list format 
   - Example: "She speaks not only French but also German, Italian, and Japanese." → "She speaks French, German, Italian, and Japanese."

REQUIREMENTS:
1. Maintain the exact meaning and intensity of the original sentence
2. PRESERVE ALL punctuation marks like hyphens, em dashes, etc. exactly as they appear
3. Keep ALL other words in the sentence exactly as they appear
4. Do not rewrite or rephrase any other part of the sentence
5. Return ONLY the transformed sentence without explanations

EXAMPLES:
- "Not only did she finish the project ahead of schedule, but she also exceeded every expectation." → "She finished the project ahead of schedule, and she also exceeded every expectation."
- "He is not only a brilliant strategist but also a compassionate leader." → "He is a brilliant strategist and also a compassionate leader."
- "The concert was not only well-organized but absolutely unforgettable." → "The concert was well-organized and absolutely unforgettable."
- "growth becomes not just possible---but sustainable" → "growth becomes both possible and sustainable"
- "Together, these conditions become the blueprint for sustainable growth---not just for your strategy, but for your culture, your leadership, and your legacy." → "Together, these conditions become the blueprint for sustainable growth---for your strategy, and for your culture, your leadership, and your legacy."
- "When trust is broken, performance suffers. But when trust is strong, teams move faster. People contribute more. Customers come back. And growth becomes not just possible---but sustainable." → "When trust is broken, performance suffers. But when trust is strong, teams move faster. People contribute more. Customers come back. And growth becomes both possible and sustainable."

INPUT:
{text}

TRANSFORMED SENTENCE:
"""
        
        # Call the API with the specialized prompt
        formatted_prompt = prompt.format(text=text)
        
        # Increase max tokens for these special constructions to ensure complete response
        max_tokens = 200
        transformed_text = self.call_azure_openai_api(formatted_prompt, max_tokens=max_tokens)
        
        # Return original text if API call failed
        if not transformed_text:
            print(f"❌ Special handling API call failed, returning original text")
            return text
            
        print(f"✅ Special handling transformed: '{text}' → '{transformed_text}'")
        return transformed_text

    def set_prompt(self, prompt):
        """
        Set a custom prompt template for the translator.
        
        Args:
            prompt (str): Custom prompt template with {text} placeholder
        """
        self.prompt_template = prompt
        
    def contains_but_or_yet(self, text):
        """
        Check if the text contains 'but' or 'yet'.
        
        Args:
            text (str): Text to check
            
        Returns:
            bool: True if text contains 'but' or 'yet', False otherwise
        """
        # Text should already be normalized at the TextProcessor level,
        # but we'll normalize here as well for extra safety
        normalized_text = text.replace("'", "'").lower()
        
        # Check for 'but' or 'yet' patterns
        for pattern in self.but_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match:
                matched_word = match.group(0)
                print(f"✅ 'but/yet' pattern matched: '{pattern}' found '{matched_word}' in text")
                return True
                
        return False

    def _tokenize_text(self, text):
        """Split text into tokens for comparison."""
        return re.findall(r'\b[\w\'-]+\b|\S', text)

    def translate(self, text):
        """
        Translate 'but' and 'yet' friction language in the given text using Azure OpenAI.
        Enhanced with special handling for 'not just X, but Y' constructions.
        
        Args:
            text (str): Text to translate
            
        Returns:
            str: Translated text
        """
        if not text:
            return text
            
        # Check for special 'not just...but' construction first
        print(f"BUT Translator checking: '{text}'")
        
        # Prioritize detection of the special case
        if self.is_not_just_but_construction(text):
            print(f"BUT Translator: Special 'not just...but' construction found, using specialized handler")
            return self.handle_not_just_but_construction(text)
        
        # Continue with normal processing for other 'but' cases
        if not self.contains_but_or_yet(text):
            print(f"BUT Translator: No 'but' or 'yet' found, returning original text")
            return text
            
        print(f"BUT Translator: 'but' or 'yet' found, proceeding with translation")
            
        # Format the prompt
        formatted_prompt = self.prompt_template.format(text=text)
        
        # Call the Azure OpenAI API using the parent class method
        translated_text = self.call_azure_openai_api(formatted_prompt)
        
        # Return the original text if the API call failed or returned empty
        if not translated_text:
            print(f"BUT Translator: API returned empty response, returning original text")
            return text
        
        # Add conservative check to limit changes
        if translated_text and translated_text != text:
            # Compare word by word and only accept minimal changes
            words_original = self._tokenize_text(text)
            words_translated = self._tokenize_text(translated_text)
            
            # Use difflib to find exact changes
            matcher = difflib.SequenceMatcher(None, words_original, words_translated)
            
            # Get the changes
            operations = matcher.get_opcodes()
            
            # Count how many words were changed
            changed_words = sum(1 for tag, i1, i2, j1, j2 in operations if tag != 'equal')
            total_words = len(words_original)
            
            # Calculate percentage for logging
            change_percentage = (changed_words / total_words) * 100 if total_words > 0 else 0
            
            # Output detailed change information for debugging
            print(f"Words changed: {changed_words}/{total_words} ({change_percentage:.1f}%)")
            
            # If more than 20% of words changed, it's probably over-correcting
            if changed_words / total_words > 0.2 and total_words > 5:
                print(f"WARNING: Excessive changes detected ({changed_words}/{total_words} words, {change_percentage:.1f}%). Using original text.")
                print(f"Original: '{text}'")
                print(f"Rejected: '{translated_text}'")
                return text
            
        print(f"BUT Translator: Successfully translated to: '{translated_text}'")
            
        # Return the processed text
        return translated_text