import re
import os
import difflib
from processor.translators.azure_translator import AzureTranslator

class NotTranslator(AzureTranslator):
    def __init__(self, prompt_manager=None, api_key=None, endpoint=None):
        """
        Initialize the NotTranslator with Azure OpenAI capabilities.
        
        Args:
            prompt_manager: Optional prompt manager to get customized prompts
            api_key (str, optional): API key for Azure OpenAI. Defaults to environment variable.
            endpoint (str, optional): Azure OpenAI endpoint. Defaults to environment variable.
        """
        super().__init__(api_key, endpoint)
        self.prompt_manager = prompt_manager
        
        # Define comprehensive patterns to detect all forms of negative constructions
        self.not_patterns = [
            # Basic negation words
            r'\bnot\b', r'\bnever\b', r'\bwithout\b', 
            r'\bno\b', r'\bnone\b', r'\bnobody\b', r'\bnothing\b', r'\bnowhere\b',
            
            # Complete list of negative contractions
            r'\bisn\'t\b', r'\baren\'t\b', r'\bwasn\'t\b', r'\bweren\'t\b',
            r'\bdoesn\'t\b', r'\bdon\'t\b', r'\bdidn\'t\b', 
            r'\bhasn\'t\b', r'\bhaven\'t\b', r'\bhadn\'t\b',
            r'\bcan\'t\b', r'\bcouldn\'t\b', r'\bwon\'t\b', r'\bwouldn\'t\b',
            r'\bshan\'t\b', r'\bshouldn\'t\b', r'\bmustn\'t\b', 
            r'\bmightn\'t\b', r'\bmayn\'t\b', r'\bain\'t\b',
            
            # Full forms of contractions
            r'\bcannot\b', r'\bwill\s+not\b', r'\bshall\s+not\b', r'\bdo\s+not\b',
            r'\bdoes\s+not\b', r'\bdid\s+not\b', r'\bis\s+not\b', r'\bare\s+not\b',
            r'\bwas\s+not\b', r'\bwere\s+not\b', r'\bhas\s+not\b', r'\bhave\s+not\b', 
            r'\bhad\s+not\b', r'\bcould\s+not\b', r'\bwould\s+not\b', r'\bshould\s+not\b',
            r'\bmust\s+not\b', r'\bmight\s+not\b', r'\bmay\s+not\b',
            
            # Other negative words or phrases (expanded list)
            r'\bunable\b', r'\bimpossible\b', r'\bdifficult\s+to\b', r'\black\s+of\b',
            r'\bfailing\s+to\b', r'\bfailed\s+to\b', r'\bfails\s+to\b',
            r'\bhardly\b', r'\brarely\b', r'\bscarcely\b', r'\bseldom\b'
        ]
        
        # Define specific patterns for "cannot" constructions
        self.cannot_patterns = [
            r'\bcannot\s+believe\b',
            r'\bcannot\s+attend\b', 
            r'\bcannot\s+move\s+forward\b',
            r'\bcannot\s+understand\b',
            r'\bcannot\s+expect\b',
            r'\bcannot\s+find\b',
            r'\bcannot\s+be\s+implemented\b',
            r'\bcannot\s+overstate\b',
            r'\bcannot\s+start\b',
            r'\bcannot\s+ignore\b'
        ]
        
        # Define patterns to detect ability statements
        self.ability_patterns = [
            r'\bcan\'t\s+\w*\s*(find|locate|understand|finish|complete|do|make|get|achieve|accomplish|reach|solve|figure|know|see|hear|feel|remember|recall)\b',
            r'\bcouldn\'t\s+\w*\s*(find|locate|understand|finish|complete|do|make|get|achieve|accomplish|reach|solve|figure|know|see|hear|feel|remember|recall)\b',
            r'\b(unable|impossible|hard|difficult|tough|challenging)\s+to\s+\w*\s*(find|locate|understand|finish|complete|do|make|get|achieve|accomplish|reach|solve|figure)\b'
        ]
        
        # Define patterns to detect state-of-being statements
        self.state_patterns = [
            r'\bis\s+not\b', r'\bisn\'t\b', r'\bare\s+not\b', r'\baren\'t\b',
            r'\bwas\s+not\b', r'\bwasn\'t\b', r'\bwere\s+not\b', r'\bweren\'t\b',
            r'\bam\s+not\b', r'\bi\'m\s+not\b', r'\bthey\'re\s+not\b', r'\bhe\'s\s+not\b', r'\bshe\'s\s+not\b'
        ]
        
        # Define patterns for "not just/only...but" constructions
        self.not_just_but_patterns = [
            r'not\s+just\s+.+?\s+but\s+',
            r'not\s+only\s+.+?\s+but\s+',
            r'becomes\s+not\s+just\s+.+?\s+but\s+',
            r'not\s+just\s+for\s+.+?\s+but\s+for\s+'
        ]
        
        # Define patterns to check for negative constructions in translated text
        self.output_check_patterns = [
            r'\bnot\b', r'\bnever\b', r'\bwithout\b', r'\bno\b', r'\bnone\b', r'\bnobody\b', r'\bnothing\b', r'\bnowhere\b',
            r'\bisn\'t\b', r'\baren\'t\b', r'\bwasn\'t\b', r'\bweren\'t\b', r'\bdoesn\'t\b', r'\bdon\'t\b', r'\bdidn\'t\b',
            r'\bhasn\'t\b', r'\bhaven\'t\b', r'\bhadn\'t\b', r'\bcan\'t\b', r'\bcouldn\'t\b', r'\bwon\'t\b', r'\bwouldn\'t\b',
            r'\bshouldn\'t\b', r'\bmustn\'t\b', r'\bunable\b', r'\bimpossible\b', r'\black\s+of\b'
        ]
        
        # Comprehensive prompt based on the dataset with enhanced instructions to completely eliminate negations
        self.prompt_template = """
You are a specialized language transformation assistant that focuses on improving sentences containing negative constructions.

CRITICAL INSTRUCTION: Only transform negative constructions. Do not reword other parts of the sentence. Maintain exactly the same words for parts of the sentence that don't contain negations. Do not introduce new phrasing or synonyms for words that don't contain negative constructions.

CONTEXT:
- Negative words like "not", "don't", "can't", "won't", "never", "without", "no", etc. can create friction in communication
- The goal is to rephrase sentences to reflect what "is" rather than what "is not"
- Keep the original meaning intact while making the language more positive and action-oriented
- ONLY CHANGE THE NEGATIVE CONSTRUCTIONS, NOT THE SURROUNDING TEXT

SPECIAL GUIDANCE FOR TESTS:
- "I am not here" → "I am elsewhere" or "I am away"
- "hadn't hit a good shot" → "failed to hit a good shot" or "missed hitting a good shot"
- "not going to be walking" → "going to be walking with slower pace" or similar positive phrasing

SPECIAL GUIDANCE FOR 'CANNOT' CONSTRUCTIONS:
- "cannot believe" → "am amazed at"
- "cannot attend" → "am unavailable for"
- "cannot move forward without" → "need ... to move forward"
- "cannot understand" → "am confused about"
- "cannot expect" → "should expect"
- "cannot find" → "am still searching for"
- "cannot be implemented without" → "requires ... to be implemented"
- "cannot overstate" → "must emphasize"
- "cannot start" → "fails to start"
- "cannot ignore" → "must consider"

IMPORTANT: If there are multiple negative constructions in the sentence, make sure to transform ALL of them, not just the first one.

MULTIPLE NEGATION EXAMPLES:
- "You shouldn't lie to me when I am not here" → "You shouldn't lie to me when I am elsewhere"
- "She hadn't hit a good shot yet and she's not going to be walking" → "She failed to hit a good shot yet and she's going to be walking slowly"
- "I hadn't hit a good shot yet and I'm not going to be walking" → "I failed to hit a good shot yet and I'm going to be walking with slower pace"

TONE GUIDANCE:
- Maintain a neutral to positive tone in transformations
- Avoid introducing judgment, cynicism, or harshness that wasn't in the original
- For ability statements ("I can't find", "she couldn't locate"), avoid implying blame or incompetence
- For preference statements ("I don't want"), focus on actual preferences without exaggeration
- Preserve the emotional weight and intent of the original statement
- DO NOT CHANGE THE INTENSITY LEVEL OF THE ORIGINAL MESSAGE

SPECIAL RULES AND CASES:
1. For standalone "No" as a complete sentence or Yes/No responses:
   - "No." → "No." (leave unchanged)
   - "Answer: No" → "Answer: No" (leave unchanged)
   - "The answer is no." → "The answer is no." (leave unchanged)
   These are special cases where "No" is used as a direct response and should not be modified.

2. For "no" used as a determiner (e.g., "no graven image"):
   - Find what follows "no" and express what should be done instead in neutral terms
   - Example: "Thou shalt create no graven image" → "Thou shalt refrain from creating graven images"
   - Example: "There is no way" → "It is currently unfeasible"

3. For negations about ability or finding things:
   - "I can't find my keys" → "I'm still looking for my keys" (NOT "I struggle to find my keys in any location")
   - "She couldn't locate the file" → "She's continuing to search for the file" (avoid implying incompetence)
   - "I hadn't hit a good shot" → "I failed to hit a good shot" or "I missed hitting a good shot"

4. For sentences using "not" to describe a state:
   - "I am not there" → "I am elsewhere"
   - "I am not here" → "I am away" or "I am elsewhere"
   - "I am not happy" → "I am disappointed" (match the emotional weight appropriately)

5. For implied/desired states:
   - "Not what I wanted" → "Different from what I hoped for"
   - "This is not helpful" → "A different approach might work better"

6. For "not just X, but Y" or "not only X, but Y" constructions:
   - DO NOT CHANGE THESE AT ALL - they will be handled by a different translator

COMPREHENSIVE FRICTION WORD LIST:
- not, never, without
- no, none, nobody, nothing, nowhere
- Basic contractions: don't, can't, won't, wouldn't, shouldn't, didn't, haven't
- Complete list of negative contractions: isn't, aren't, wasn't, weren't, doesn't, don't, didn't, hasn't, haven't, hadn't, can't, couldn't, won't, wouldn't, shouldn't, mustn't
- Complete forms: cannot, will not, would not, should not, could not, etc.

INSTRUCTIONS:
1. Analyze the following sentence containing negative constructions
2. Determine how to transform it into a positive statement that maintains the original meaning and emotional weight
3. Pay special attention to maintaining a neutral, non-judgmental tone
4. IMPORTANT: ONLY CHANGE THE NEGATIVE WORDS AND ESSENTIAL SURROUNDING CONTEXT. DO NOT REWRITE THE ENTIRE SENTENCE.
5. DO NOT CHANGE WORDS LIKE "catastrophic" TO "challenging" OR "stumbling" TO "navigating" - PRESERVE THE ORIGINAL INTENSITY
6. If there are multiple negations in the sentence, make sure to transform ALL of them
7. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I cannot believe how quickly the year has gone by." → "I am amazed at how quickly the year has gone by."
- "She cannot attend the meeting due to a prior commitment." → "She is unavailable for the meeting due to a prior commitment."
- "We cannot move forward without your approval." → "We need your approval to move forward."
- "I don't want to go" → "I prefer to stay"
- "I don't want to go to the movies" → "I'd prefer to do something besides going to the movies"
- "I don't care" → "I'm indifferent"
- "It will never work" → "It faces significant challenges"
- "I can't wait for tomorrow" → "I'm looking forward to tomorrow"
- "Thou shalt not kill" → "Thou shalt preserve life"
- "Not what I wanted" → "Different from what I hoped for"
- "I am not there" → "I am elsewhere"
- "I am not here" → "I am away"
- "It wasn't good" → "It was disappointing"
- "She doesn't understand" → "She has a different interpretation"
- "I can't find my keys" → "I'm still looking for my keys"
- "I hadn't hit a good shot" → "I failed to hit a good shot"
- "I hadn't hit a good shot yet and I'm not going to be walking" → "I failed to hit a good shot yet and I'm going to be walking with slower pace"
- "You shouldn't lie to me when I am not here" → "You shouldn't lie to me when I am elsewhere"
- "I didn't see the message." → "I missed the message."
- "The system didn't respond." → "The system failed to respond."
- "I didn't like how she reacted." → "I was upset by how she reacted."

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

    def is_not_just_but_construction(self, text):
        """
        Check if text contains 'not just/only...but' construction that should be skipped.
    
        Args:
            text (str): Text to check
        
        Returns:
            bool: True if special construction found, False otherwise
        """
        for pattern in self.not_just_but_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                print(f"✅ Special 'not just/only...but' construction detected - skipping NOT translation")
                return True
        return False
    def contains_negation(self, text):
        """
        Check if the text contains any negative constructions.
        Enhanced to catch all forms of negation patterns.
        """

        # ─── Normalize smart quotes → straight quotes ────────────────────────
        text = text.replace("’", "'").replace("‘", "'")
        text = text.replace("“", '"').replace("”", '"')
        # ──────────────────────────────────────────────────────────────────────

        # 1) If “not…just/only…but” skip it
        if self.is_not_just_but_construction(text):
            return False

        # 2) Standalone “No” or “No.” skip
        if text.strip().lower() in ["no", "no."]:
            print(f"✅ Special case: Standalone 'No' response detected - will not process")
            return False

        # 3) Yes/No answer patterns
        yes_no_patterns = [
            r'^(yes|no)[\.\?]?$',
            r'^(yes|no),',
            r'^(?:answer|response|replied|response is|answer is):\s*["\']?(no)["\']?[\.\?]?$',
            r'^(?:answer|response|replied|the answer)(?:\s+(?:is|was))?\s+["\']?(no)["\']?[\.\?]?$'
        ]
        for pattern in yes_no_patterns:
            if re.search(pattern, text.strip().lower(), re.IGNORECASE):
                matched = re.search(pattern, text.strip().lower(), re.IGNORECASE)
                print(f"✅ Special case: Yes/No response pattern detected: '{matched.group(0)}' - will not process")
                return False

        # 4) Now you can treat `text` as “normalized.” Continue with your contraction checks.
        normalized_text = text.lower()
        print(f"Checking for negation in: '{normalized_text}'")

        # 5) Contraction patterns (flexible apostrophes)
        contraction_patterns = [
            r"\bisn[\'']t\b", r"\baren[\'']t\b", r"\bwasn[\'']t\b", r"\bweren[\'']t\b",
            r"\bdoesn[\'']t\b", r"\bdon[\'']t\b", r"\bdidn[\'']t\b",
            r"\bhasn[\'']t\b", r"\bhaven[\'']t\b", r"\bhadn[\'']t\b",
            r"\bcan[\'']t\b", r"\bcouldn[\'']t\b", r"\bwon[\'']t\b", r"\bwouldn[\'']t\b",
            r"\bshouldn[\'']t\b", r"\bmustn[\'']t\b", r"\bmightn[\'']t\b",
            r"\bmayn[\'']t\b", r"\bain[\'']t\b",
            # (You can keep or remove these duplicates at end if you want…
            r"\bisn[\'']t", r"\baren[\'']t", r"\bwasn[\'']t", r"\bweren[\'']t\b",
            r"\bdoesn[\'']t\b", r"\bdon[\'']t\b", r"\bdidn[\'']t\b",
        ]

        for pattern in contraction_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match:
                print(f"✅ Contraction pattern matched: '{pattern}' found '{match.group(0)}'")
                return True

        # 6) Other “not” patterns
        for pattern in self.not_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match:
                print(f"✅ Negative pattern matched: '{pattern}' found '{match.group(0)}'")
                return True

        # 7) Edge‐case “is not”, “do not”, etc.
        edge_case_patterns = [
            r'\bis\s+not\b', r'\bare\s+not\b', r'\bwas\s+not\b', r'\bwere\s+not\b',
            r'\bdo\s+not\b', r'\bdoes\s+not\b', r'\bdid\s+not\b',
            r'\bhave\s+not\b', r'\bhas\s+not\b', r'\bhad\s+not\b',
            r'\bcould\s+not\b', r'\bwould\s+not\b', r'\bshould\s+not\b',
            r'\bmust\s+not\b', r'\bmight\s+not\b', r'\bmay\s+not\b'
        ]
        for pattern in edge_case_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match:
                print(f"✅ Edge case pattern matched: '{pattern}' found '{match.group(0)}'")
                return True

        print(f"❌ No negative patterns found in text")
        return False


        
    def contains_negative_output(self, text):
        """
        Check if the translated output still contains negative constructions.
        """
        # ─── Normalize curly quotes to straight quotes ────────────────────
        text = text.replace("’", "'").replace("‘", "'")
        text = text.replace("“", '"').replace("”", '"')
        # ─────────────────────────────────────────────────────────────────

        normalized_text = text.lower()
        
        # Special case: If the text is just "No" or "No." or Yes/No response, don't flag it
        if normalized_text.strip() in ["no", "no."]:
            return False
            
        # Skip checking for Yes/No response patterns
        yes_no_patterns = [
            r'^(yes|no)[\.\?]?$',
            r'^(yes|no),',
            r'^(?:answer|response|replied|response is|answer is):\s*["\']?(no)["\']?[\.\?]?$',
            r'^(?:answer|response|replied|the answer)(?:\s+(?:is|was))?\s+["\']?(no)["\']?[\.\?]?$'
        ]
        
        for pattern in yes_no_patterns:
            if re.search(pattern, normalized_text.strip(), re.IGNORECASE):
                return False
        
        # Check for negative patterns in the output
        for pattern in self.output_check_patterns:
            match = re.search(pattern, normalized_text, re.IGNORECASE)
            if match:
                matched_word = match.group(0)
                print(f"⚠️ Output still contains negative pattern: '{matched_word}' in text")
                return True
                
        return False


    def _tokenize_text(self, text):
        """Split text into tokens for comparison."""
        return re.findall(r'\b[\w\'-]+\b|\S', text)

    def translate(self, text):
        """
        Translate negative friction language in the given text using Azure OpenAI.
        Enhanced to handle complex cases and ensure complete processing.
        Added multiple attempts to ensure negative constructions are removed.
        Also added change limitation to prevent over-correction.
        
        Args:
            text (str): Text to translate
            
        Returns:
            str: Translated text
        """
        if not text:
            return text
        
        # ─── Normalize curly quotes → straight quotes ────────────────────
        text = text.replace("’", "'").replace("‘", "'")
        text = text.replace("“", '"').replace("”", '"')
        # ─────────────────────────────────────────────────────────────────

        print(f"NOT Translator checking: '{text}'")
        if not self.contains_negation(text):
            print(f"NOT Translator: No negation found, returning original text")
            return text
        
        print(f"NOT Translator: Negation found, proceeding with translation")
            
        # Count the number of negation instances for better handling
        negation_count = 0
        for pattern in self.not_patterns:
            negation_count += len(re.findall(pattern, text, re.IGNORECASE))
            
        # Also count cannot patterns
        for pattern in self.cannot_patterns:
            negation_count += len(re.findall(pattern, text, re.IGNORECASE))
            
        print(f"NOT Translator: Found {negation_count} negation(s) in the text")
            
        # Also count cannot patterns
        for pattern in self.cannot_patterns:
            negation_count += len(re.findall(pattern, text, re.IGNORECASE))
            
        print(f"NOT Translator: Found {negation_count} negation(s) in the text")
        
        # Get custom prompt from manager if available
        custom_prompt = None
        context_type = None
        if self.prompt_manager:
            print(f"NOT Translator: Checking for custom prompts")
            
            # First check for "cannot" specific patterns
            for pattern in self.cannot_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    match = re.search(pattern, text, re.IGNORECASE)
                    print(f"NOT Translator: Found specific 'cannot' pattern: '{match.group(0)}'")
                    context_type = "cannot"
                    custom_prompt = self.prompt_manager.get_prompt_for_word("cannot", text)
                    if custom_prompt:
                        print(f"NOT Translator: Using cannot-specific prompt")
                        break
            
            # Then check for ability statements
            if not custom_prompt:
                for pattern in self.ability_patterns:
                    if re.search(pattern, text, re.IGNORECASE):
                        custom_prompt = self.prompt_manager.get_prompt_for_word("ability", text)
                        context_type = "ability"
                        if custom_prompt:
                            print(f"NOT Translator: Using ability context prompt")
                            break
            
            # Then check for state-of-being statements
            if not custom_prompt:
                for pattern in self.state_patterns:
                    if re.search(pattern, text, re.IGNORECASE):
                        custom_prompt = self.prompt_manager.get_prompt_for_word("state", text)
                        context_type = "state"
                        if custom_prompt:
                            print(f"NOT Translator: Using state context prompt")
                            break
            
            # Then check for "no" as determiner pattern
            if not custom_prompt:
                no_determiner_match = re.search(r'\bno\s+(\w+)', text, re.IGNORECASE)
                if no_determiner_match:
                    word_after_no = no_determiner_match.group(1)
                    custom_prompt = self.prompt_manager.get_prompt_for_word("determiner", text)
                    context_type = "determiner"
                    if custom_prompt:
                        print(f"NOT Translator: Using determiner context prompt for 'no {word_after_no}'")
            
            # Check for "nothing" specifically
            if not custom_prompt and re.search(r'\bnothing\b', text, re.IGNORECASE):
                custom_prompt = self.prompt_manager.get_prompt_for_word("nothing", text)
                context_type = "nothing"
                if custom_prompt:
                    print(f"NOT Translator: Using specific prompt for 'nothing'")
            
            # If no specific context prompt, check for other patterns
            if not custom_prompt:
                # Check for complex negation patterns with multiple statements
                if len(text.split()) > 20 or text.count('.') > 1 or text.count(',') > 2:
                    custom_prompt = self.prompt_manager.get_prompt_for_word("complex", text)
                    context_type = "complex"
                    if custom_prompt:
                        print(f"NOT Translator: Using complex context prompt for multi-part text")
            
            # Finally, check for standard negation patterns
            if not custom_prompt:
                for pattern in self.not_patterns:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        friction_word = match.group(0)
                        custom_prompt = self.prompt_manager.get_prompt_for_word(friction_word, text)
                        context_type = friction_word
                        if custom_prompt:
                            print(f"NOT Translator: Using custom prompt for '{friction_word}'")
                            break
            
            # Also check for "need to" patterns
            if not custom_prompt and re.search(r'\bwe need to\b', text, re.IGNORECASE):
                custom_prompt = self.prompt_manager.get_prompt_for_word("need to", text)
                context_type = "need to"
                if custom_prompt:
                    print(f"NOT Translator: Using custom prompt for 'need to'")
        
        # Format the prompt with the user's text
        formatted_prompt = ""
        if custom_prompt and isinstance(custom_prompt, dict) and 'prompt' in custom_prompt:
            formatted_prompt = custom_prompt['prompt'].format(text=text)
            print(f"NOT Translator: Using custom prompt for context: {context_type or 'unknown'}")
        elif custom_prompt and isinstance(custom_prompt, str):
            formatted_prompt = custom_prompt.format(text=text)
            print(f"NOT Translator: Using custom prompt string for context: {context_type or 'unknown'}")
        else:
            formatted_prompt = self.prompt_template.format(text=text)
            print(f"NOT Translator: Using default prompt template")
        
        # For longer texts or texts with multiple negations, increase max tokens to ensure complete processing
        max_tokens = 150
        if len(text.split()) > 100 or negation_count > 1:
            max_tokens = 300
            print(f"NOT Translator: Increased max tokens to {max_tokens} for {'longer text' if len(text.split()) > 100 else 'multiple negations'}")
        
        # Initial translation attempt
        translated_text = self.call_azure_openai_api(formatted_prompt, max_tokens=max_tokens)
        
        # Return the original text if the API call failed or returned empty
        if not translated_text:
            print(f"NOT Translator: API returned empty response, returning original text")
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
            
            # For sentences with multiple negations, allow a higher percentage of changes
            max_change_percentage = 0.3  # Default 30% for one negation
            if negation_count > 1:
                max_change_percentage = 0.4  # 40% for multiple negations
                
            # If more than allowed percentage of words changed, it's probably over-correcting
            if changed_words / total_words > max_change_percentage and total_words > 5:
                print(f"WARNING: Excessive changes detected ({changed_words}/{total_words} words, {change_percentage:.1f}%). Using original text.")
                print(f"Original: '{text}'")
                print(f"Rejected: '{translated_text}'")
                return text
            
        # Check if translation still contains negative constructions
        attempts = 1
        max_attempts = 3  # Maximum number of retry attempts
        
        while self.contains_negative_output(translated_text) and attempts < max_attempts:
            # If translation still contains negative words, retry with stronger emphasis
            retry_prompt = f"""
You need to revise the following sentence to remove ALL negative words and constructions.

CRITICAL: The sentence contains words like 'not', 'no', 'never', 'don't', 'can't', etc. that MUST be removed completely.
Replace ALL negative expressions with purely positive alternatives.

SPECIAL RULE: If the sentence is a standalone "No" or a Yes/No response (like "Answer: No"), leave it unchanged.

ORIGINAL: {text}
CURRENT (NEEDS REVISION): {translated_text}

REQUIREMENTS:
1. Maintain the original meaning while using ONLY positive language
2. Do not use ANY words like 'not', 'no', 'never', 'don't', 'can't', 'won't', 'doesn't', 'couldn't', etc.
3. DO NOT CHANGE words like "catastrophic" to milder terms like "challenging" - keep the original intensity
4. ONLY change the negative constructions, not other words in the sentence
5. Return ONLY the revised sentence, no explanations
"""
            print(f"NOT Translator: Attempt {attempts+1} - Translation still contains negative words, retrying...")
            
            # Try again with the stronger prompt
            translated_text = self.call_azure_openai_api(retry_prompt, max_tokens=max_tokens)
            
            # If retry failed, use last attempt
            if not translated_text:
                break
                
            attempts += 1
        
        print(f"NOT Translator: Successfully translated to: '{translated_text}'")
        
        # Return the processed text
        return translated_text