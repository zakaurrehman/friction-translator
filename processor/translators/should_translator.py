import re
import os
import difflib
from processor.translators.azure_translator import AzureTranslator

class ShouldTranslator(AzureTranslator):
    def __init__(self, prompt_manager=None, api_key=None, endpoint=None):
        """
        Initialize the ShouldTranslator with Azure OpenAI capabilities.
        
        Args:
            prompt_manager: Optional prompt manager to get customized prompts
            api_key (str, optional): API key for Azure OpenAI. Defaults to environment variable.
            endpoint (str, optional): Azure OpenAI endpoint. Defaults to environment variable.
        """
        super().__init__(api_key, endpoint)
        self.prompt_manager = prompt_manager
        
        # Define patterns to detect if the text contains modal verbs with improved negative form detection
        self.should_patterns = [
            r'\bshould\b', r'\bshouldn\'?t\b', 
            r'\bcould\b', r'\bcouldn\'?t\b', 
            r'\bwould\b', r'\bwouldn\'?t\b',
            r'\bwe need to\b'
        ]
        
        # Comprehensive prompt based on the dataset with improved instructions
        self.prompt_template = """
You are a specialized language transformation assistant that focuses only on improving sentences containing modal verbs like "should", "could", "would", and phrases like "we need to".

CRITICAL INSTRUCTION: Only transform the modal verbs themselves. Do not reword other parts of the sentence. Maintain exactly the same words for parts of the sentence that don't contain modal verbs. Do not introduce new phrasing or synonyms for words that don't contain modal constructions.

CONTEXT:
The word "should" and similar modal verbs often create resistance in others as many feel they are being told what to do rather than having a choice. The goal is to replace these words with alternatives that better match the intended level of optionality.

FRICTION WORD LIST:
- should
- could
- would
- shouldn't
- couldn't
- wouldn't
- we need to

RULES FOR REPLACEMENT:
1. HIGH OPTIONALITY (low degree of forcefulness):
   - Replace "should" with "might"
   - Replace "shouldn't" with "might not"
   - Replace "could" with "might" 
   - Replace "couldn't" with "might not"
   - Replace "would" with "might"
   - Replace "wouldn't" with "might not"
   - Example: "You should try the new restaurant downtown" → "You might try the new restaurant downtown"
   - Example: "You shouldn't ignore the signs of declining employee morale" → "You might not ignore the signs of declining employee morale"
   - Example: "She could have finished earlier, but she got distracted" → "She might have finished earlier, but she got distracted"
   - When to use: Personal preferences, casual suggestions, hypothetical scenarios

2. MODERATE OPTIONALITY:
   - Replace "should" with "recommend" (using "I recommend you" format)
   - Replace "shouldn't" with "recommend not" (using "I recommend you not" format)
   - Replace "would" to "recommend" where appropriate
   - Replace "wouldn't" to "recommend not" where appropriate
   - Example: "You should always follow through on your commitments" → "I recommend you always follow through on your commitments"
   - Example: "I wouldn't recommend launching the product without more testing" → "I recommend not launching the product without more testing"
   - When to use: Professional advice, recommendations based on expertise, best practices

3. LOW OPTIONALITY (high degree of forcefulness):
   - Replace "should" with "want you to" (using "I want you to" format)
   - Replace "shouldn't" with "must not"
   - Replace "would" with appropriate form to indicate requirement
   - Replace "wouldn't" with "must not"
   - Example: "This is very important, and you should try to get the work done today" → "This is very important, and I want you to try to get the work done today"
   - Example: "He wouldn't compromise his values for short-term success" → "He must not compromise his values for short-term success"
   - Example: "They shouldn't wait too long to make a decision" → "They must not wait too long to make a decision"
   - When to use: Critical actions, safety issues, core values, firm requirements

4. SPECIAL CASES:
   - For "we need to" phrases: Replace with "It would be beneficial to" or similar forms
   - Example: "We need to focus on rebuilding trust in leadership" → "It would be beneficial to focus on rebuilding trust in leadership"
   - Example: "We need to find new ways to foster collaboration" → "It would be beneficial to find new ways to foster collaboration"
   
   - For "could" when expressing ability or perception: Replace with "was able to" or similar forms
   - Example: "She could see the hesitation in his eyes" → "She was able to see the hesitation in his eyes"
   
   - For "couldn't believe": Replace with "was surprised by"
   - Example: "She couldn't believe how quickly things had changed" → "She was surprised by how quickly things had changed"

IMPORTANT: If there are multiple modal verbs in the sentence, make sure to replace ALL of them appropriately, not just the first one. Process each instance independently based on its context.

MULTIPLE FRICTION WORD EXAMPLES:
- "You shouldn't lie to me when I am not here" → "You might not lie to me when I am not here"
- "I agree with your plan, but we should consider the risks" → "I agree with your plan, but we might consider the risks"
- "She wouldn't have believed it if she hadn't seen it herself" → "She might have believed it if she hadn't seen it herself"

PROCESSING INSTRUCTIONS:
1. Identify ALL modal verbs in the sentence and determine the appropriate level of optionality based on the context for each one.
2. Apply the appropriate replacement rule from above to EACH modal verb found.
3. IMPORTANT: ONLY CHANGE THE MODAL VERBS THEMSELVES AND ESSENTIAL CONNECTING WORDS. DO NOT REWRITE THE ENTIRE SENTENCE.
4. DO NOT CHANGE ANY OTHER WORDS in the sentence that are not modal verbs.
5. DO NOT CHANGE WORDS LIKE "catastrophic" TO "challenging" OR "stumbling" TO "navigating" - PRESERVE THE ORIGINAL INTENSITY.
6. Return ONLY the transformed sentence without any explanations.

INPUT SENTENCE:
{text}

TRANSFORMED SENTENCE:
"""

    def set_prompt(self, prompt):
        """
        Set a custom prompt template for the translator.
        
        Args:
            prompt (str): Custom prompt template with {text} placeholder
        """
        self.prompt_template = prompt

    def contains_modal_verbs(self, text):
        """
        Check if the text contains any modal verbs or "we need to" phrases.
        
        Args:
            text (str): Text to check
            
        Returns:
            bool: True if text contains modal verbs, False otherwise
        """
        normalized_text = text.replace("'", "'").lower()
        for pattern in self.should_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match:
                matched_word = match.group(0)
                print(f"✅ Modal verb matched: '{pattern}' found '{matched_word}' in text")
                return True
        print(f"❌ No modal verbs found in text")
        return False

    def _tokenize_text(self, text):
        """Split text into tokens for comparison."""
        return re.findall(r'\b[\w\'-]+\b|\S', text)

    def translate(self, text):
        """
        Translate modal verbs in the given text using Azure OpenAI.
        Enhanced with conservative approach to prevent over-correction.
        Improved to handle multiple modal verbs in the same sentence.
        
        Args:
            text (str): Text to translate
            
        Returns:
            str: Translated text
        """
        if not text:
            return text
        
        # Only process if text contains modal verbs or "we need to" phrases
        print(f"SHOULD Translator checking: '{text}'")
        if not self.contains_modal_verbs(text):
            print(f"SHOULD Translator: No modal verbs found, returning original text")
            return text
            
        print(f"SHOULD Translator: Modal verbs found, proceeding with translation")
        
        # Count the number of modal verbs for better handling
        modal_verb_count = 0
        for pattern in self.should_patterns:
            modal_verb_count += len(re.findall(pattern, text, re.IGNORECASE))
            
        print(f"SHOULD Translator: Found {modal_verb_count} modal verb(s) in the text")
        
        # Handle case with numbered examples from the original implementation
        # This keeps compatibility with specific example handling from original code
        if re.match(r'^\d+\.\s+"', text):
            try:
                # Extract the quoted text
                quoted_text = re.search(r'"([^"]*)"', text).group(1)
                
                # Process just the quoted part
                # Get custom prompt from manager if available
                custom_prompt = None
                if self.prompt_manager:
                    for pattern in self.should_patterns:
                        match = re.search(pattern, quoted_text, re.IGNORECASE)
                        if match:
                            friction_word = match.group(0)
                            custom_prompt = self.prompt_manager.get_prompt_for_word(friction_word, quoted_text)
                            break
                
                # Format the prompt
                formatted_prompt = ""
                if custom_prompt and isinstance(custom_prompt, dict) and 'prompt' in custom_prompt:
                    formatted_prompt = custom_prompt['prompt'].format(text=quoted_text)
                elif custom_prompt and isinstance(custom_prompt, str):
                    formatted_prompt = custom_prompt.format(text=quoted_text)
                else:
                    formatted_prompt = self.prompt_template.format(text=quoted_text)
                
                # Call the API using the parent class method
                translated_quoted = self.call_azure_openai_api(formatted_prompt)
                
                # Use original if API call failed or returned empty
                if not translated_quoted:
                    return text
                
                # Apply conservative check to the quoted part
                words_original = self._tokenize_text(quoted_text)
                words_translated = self._tokenize_text(translated_quoted)
                
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
                
                # If more than 30% of words changed, it's probably over-correcting
                # For multiple modal verbs, we allow a higher percentage of changes (40%)
                max_change_percentage = 0.3
                if modal_verb_count > 1:
                    max_change_percentage = 0.4
                
                if changed_words / total_words > max_change_percentage and total_words > 5:
                    print(f"WARNING: Excessive changes detected ({changed_words}/{total_words} words, {change_percentage:.1f}%). Using original text.")
                    print(f"Original: '{quoted_text}'")
                    print(f"Rejected: '{translated_quoted}'")
                    return text
                
                # Replace the quoted part in the original text
                return text.replace(quoted_text, translated_quoted)
            except (AttributeError, IndexError):
                # If there's an issue parsing, just process the whole text
                pass
            
        # Get custom prompt from manager if available
        custom_prompt = None
        context_type = None
        if self.prompt_manager:
            for pattern in self.should_patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    friction_word = match.group(0)
                    # Determine context for the word
                    context = self._determine_context(friction_word, text)
                    context_type = context
                    custom_prompt = self.prompt_manager.get_prompt_for_word(friction_word, context)
                    if custom_prompt:
                        print(f"SHOULD Translator: Using custom prompt for '{friction_word}' with context: '{context}'")
                    break
        
        # Format the prompt
        formatted_prompt = ""
        if custom_prompt and isinstance(custom_prompt, dict) and 'prompt' in custom_prompt:
            formatted_prompt = custom_prompt['prompt'].format(text=text)
            print(f"SHOULD Translator: Using custom prompt dict for context: {context_type or 'unknown'}")
        elif custom_prompt and isinstance(custom_prompt, str):
            formatted_prompt = custom_prompt.format(text=text)
            print(f"SHOULD Translator: Using custom prompt string for context: {context_type or 'unknown'}")
        else:
            formatted_prompt = self.prompt_template.format(text=text)
            print(f"SHOULD Translator: Using default prompt template")
        
        # Call the Azure OpenAI API using the parent class method
        # Increase max tokens for sentences with multiple modal verbs
        max_tokens = 150
        if modal_verb_count > 1:
            max_tokens = 250
            print(f"SHOULD Translator: Increased max tokens to {max_tokens} for multiple modal verbs")
            
        translated_text = self.call_azure_openai_api(formatted_prompt, max_tokens=max_tokens)
        
        # Return the original text if the API call failed or returned empty
        if not translated_text:
            print(f"SHOULD Translator: API returned empty response, returning original text")
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
            
            # For sentences with multiple modal verbs, allow a higher percentage of changes
            max_change_percentage = 0.3  # Default 30% for one modal verb
            if modal_verb_count > 1:
                max_change_percentage = 0.4  # 40% for multiple modal verbs
                
            # If more than allowed percentage of words changed, it's probably over-correcting
            if changed_words / total_words > max_change_percentage and total_words > 5:
                print(f"WARNING: Excessive changes detected ({changed_words}/{total_words} words, {change_percentage:.1f}%). Using original text.")
                print(f"Original: '{text}'")
                print(f"Rejected: '{translated_text}'")
                return text
                
            # Check if all modal verbs were properly handled
            remaining_modal_verbs = []
            for pattern in self.should_patterns:
                matches = re.finditer(pattern, translated_text, re.IGNORECASE)
                for match in matches:
                    remaining_modal_verbs.append(match.group(0))
                    
            if remaining_modal_verbs:
                print(f"WARNING: Translated text still contains modal verbs: {remaining_modal_verbs}")
        
        print(f"SHOULD Translator: Successfully translated to: '{translated_text}'")
            
        # Return the processed text
        return translated_text

    def _determine_context(self, friction_word, text):
        """
        Determine the appropriate context (high, moderate, low optionality) based on the text.
        This is a simple heuristic and can be improved for better context detection.
        
        Args:
            friction_word (str): The detected friction word
            text (str): The full text
            
        Returns:
            str: The context type ('high', 'moderate', or 'low')
        """
        # Default to moderate optionality
        context = 'moderate'
        
        # Check for signals of low optionality (high forcefulness)
        low_optionality_signals = [
            'must', 'critical', 'essential', 'required', 'important', 'necessary',
            'safety', 'urgent', 'immediately', 'values', 'principles', 'integrity'
        ]
        
        # Check for signals of high optionality (low forcefulness)
        high_optionality_signals = [
            'perhaps', 'maybe', 'possibly', 'consider', 'option', 'suggestion',
            'personal', 'preference', 'if you want', 'if you like', 'hypothetical'
        ]
        
        # Convert text to lowercase for case-insensitive matching
        lower_text = text.lower()
        
        # If it's a "we need to" phrase, default to low optionality
        if "we need to" in lower_text:
            return 'low'
            
        # Check for special case of "couldn't believe"
        if "couldn't believe" in lower_text or "could not believe" in lower_text:
            return 'special'
            
        # Check for perception verbs with "could"
        perception_verbs = ['see', 'hear', 'feel', 'sense', 'notice', 'observe']
        if friction_word.lower() == 'could' and any(f"could {verb}" in lower_text for verb in perception_verbs):
            return 'special'
        
        # Count signals for each category
        low_signals = sum(1 for signal in low_optionality_signals if signal in lower_text)
        high_signals = sum(1 for signal in high_optionality_signals if signal in lower_text)
        
        # Determine context based on signal counts
        if low_signals > high_signals:
            context = 'low'
        elif high_signals > low_signals:
            context = 'high'
        
        return context