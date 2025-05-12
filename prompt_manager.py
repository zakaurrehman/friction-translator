import json
import os
import re

class PromptManager:
    def __init__(self, prompts_file='prompts.json'):
        """
        Initialize the PromptManager with custom prompts from file.
        
        Args:
            prompts_file (str): Path to the prompts JSON file
        """
        self.prompts_file = prompts_file
        self.prompts = self._load_prompts()
        
        # Default prompts for each word type if none are defined in the file
        self.default_prompts = {
            'but': {
                'default': {
                    'prompt': """
You are a specialized translation assistant that focuses only on improving sentences containing the words 'but' or 'yet'.

CONTEXT:
- The words 'but' and 'yet' can create friction in communication
- In some contexts, they should be replaced with alternatives like 'and' or 'and at the same time'
- In other contexts, they should be left unchanged depending on their function

INSTRUCTIONS:
1. Analyze the following sentence containing 'but' or 'yet'
2. Determine if the word is being used:
   - As a contrasting conjunction (replace with 'and at the same time' or similar)
   - As a synonym for 'only' or 'merely' (leave as 'but')
   - As part of 'not only...but also' construction (replace with 'and also')
   - As meaning 'except for' (replace with 'except')
   - As an adverb meaning 'up until now' (leave 'yet' unchanged)
3. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I like the idea, but I think we need more time." → "I like the idea, and at the same time I think we need more time."
- "He is but a child." → "He is but a child." (unchanged)
- "Everyone is invited but John." → "Everyone is invited except John."
- "The design looks good, yet it could be improved." → "The design looks good, and at the same time it could be improved."

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:
""",
                    'example': {
                        'from': "I like the idea, but I think we need more time.",
                        'to': "I like the idea, and at the same time I think we need more time."
                    }
                }
            },
            'should': {
                'default': {
                    'prompt': """
You are a specialized translation assistant that focuses only on improving sentences containing modal verbs like "should", "could", "would" and phrases like "we need to".

CONTEXT:
- Modal verbs like "should", "could", and "would" can create friction in communication
- The translation depends on the context and level of optionality needed
- "We need to" phrases often imply obligation that should be made clear

TONE GUIDANCE:
- Maintain a supportive, non-judgmental tone in transformations
- Avoid sounding cynical, harsh, or condescending in replacements
- Preserve the intent and emotional weight of the original message
- Avoid introducing new judgments not present in the original text

INSTRUCTIONS:
1. Analyze the following sentence containing modal verbs or "we need to" phrases
2. Determine the appropriate translation based on context:
   - High optionality contexts (personal preferences, beliefs): "should" → "might" or "could consider"
   - Moderate optionality contexts (recommendations, suggestions): "should" → "recommend" or "suggest"
   - Low optionality contexts (critical actions, values): "should" → "is important to" or "is needed to"
   - "We need to" phrases → "It would be beneficial to" or similar phrases that maintain the importance without sounding demanding
3. Ensure the transformation maintains a supportive, non-judgmental tone
4. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "You shouldn't ignore the signs of declining employee morale." → "You might want to pay attention to the signs of declining employee morale."
- "He wouldn't compromise his values for short-term success." → "He considers it important to maintain his values over short-term success."
- "She couldn't believe how quickly things had changed." → "She was surprised by how quickly things had changed."
- "You should always follow through on your commitments." → "I recommend following through on your commitments consistently."
- "We need to focus on rebuilding trust in leadership." → "It would be beneficial to focus on rebuilding trust in leadership."

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:
""",
                    'example': {
                        'from': "You should always follow through on your commitments.",
                        'to': "I recommend following through on your commitments consistently."
                    }
                }
            },
            'not': {
                'default': {
                    'prompt': """
You are a specialized language transformation assistant that focuses only on improving sentences containing negative constructions.

CRITICAL INSTRUCTION:
The transformed sentence MUST NOT contain ANY negative words or constructions whatsoever. This includes: not, no, never, without, isn't, don't, can't, won't, couldn't, wouldn't, shouldn't, unable, impossible, lack of, failed to, hardly, rarely, none, nothing, nowhere, etc. Every single negative construction MUST be replaced with a purely positive alternative.

CONTEXT:
- Negative words like "not", "don't", "can't", "won't", "never", "without", "no", etc. create friction in communication
- The goal is to rephrase sentences to reflect what "is" rather than what "is not"
- Keep the original meaning intact while making the language completely positive and action-oriented

TONE GUIDANCE:
- Maintain a neutral to positive tone in transformations
- Avoid introducing judgment, cynicism, or harshness that wasn't in the original
- For ability statements ("I can't find", "she couldn't locate"), avoid implying blame or incompetence
- For preference statements ("I don't want"), focus on actual preferences without exaggeration
- Preserve the emotional weight and intent of the original statement

TRANSFORMATION PATTERNS:
1. For "can't/couldn't/unable to":
   - "I can't find my keys" → "I'm still looking for my keys"
   - "She couldn't understand" → "She seeks clarity"

2. For "not" in descriptions:
   - "I am not there" → "I am elsewhere"
   - "This is not good" → "This is disappointing"

3. For "don't/doesn't/didn't want":
   - "I don't want to go" → "I prefer to stay"
   - "She didn't want the promotion" → "She preferred her current position"

4. For "won't/wouldn't":
   - "I won't do it" → "I decline to do it"
   - "He wouldn't help" → "He chose to abstain from helping"

5. For "no/none/nothing":
   - "I have no money" → "I'm currently out of funds"
   - "There is nothing we can do" → "We have exhausted our options"
   - "None of the options work" → "All the options are ineffective"

6. For "never":
   - "I never succeed" → "I consistently face challenges"
   - "She never arrives on time" → "She consistently arrives late"

7. For "not what I wanted":
   - "This is not what I wanted" → "This differs from my expectations"

SPECIAL RULES AND CASES:
1. For "no" used as a determiner (e.g., "no graven image"):
   - Find what follows "no" and express what should be done instead in neutral terms
   - Example: "Thou shalt create no graven image" → "Thou shalt refrain from creating graven images"
   - Example: "There is no way" → "It is currently unfeasible"

2. For negations about ability or finding things:
   - "I can't find my keys" → "I'm still looking for my keys" (NOT "I struggle to find my keys in any location")
   - "She couldn't locate the file" → "She's continuing to search for the file" (avoid implying incompetence)

3. For sentences using "not" to describe a state:
   - "I am not there" → "I am elsewhere"
   - "I am not happy" → "I am disappointed" (match the emotional weight appropriately)

4. For implied/desired states:
   - "Not what I wanted" → "Different from what I hoped for"
   - "This is not helpful" → "A different approach might work better"

INSTRUCTIONS:
1. Analyze the following sentence containing negative constructions
2. Determine how to transform it into a purely positive statement that maintains the original meaning
3. Pay special attention to maintaining a neutral, non-judgmental tone
4. MOST IMPORTANT: After transformation, verify that NO negative constructions remain in your answer. If ANY negative words (not, no, never, don't, can't, won't, etc.) appear in your transformed sentence, revise it again to eliminate them completely.
5. It's better to use more words to express something positively than to use a concise negative expression.
6. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I don't want to go" → "I prefer to stay"
- "I don't want to go to the movies" → "I'd prefer to do something besides going to the movies"
- "I don't care" → "I'm indifferent"
- "It will never work" → "It faces significant challenges"
- "I can't wait for tomorrow" → "I'm looking forward to tomorrow"
- "Thou shalt not kill" → "Thou shalt preserve life"
- "Not what I wanted" → "Different from what I hoped for"
- "I am not there" → "I am elsewhere"
- "It wasn't good" → "It was disappointing"
- "She doesn't understand" → "She has a different interpretation"
- "I can't find my keys" → "I'm still looking for my keys"
- "I have not failed" → "I have succeeded in other ways"
- "Ways that won't work" → "Approaches that taught me valuable lessons"
- "Not everything that is faced can be changed" → "Some things we face remain the same"
- "Nothing can be changed until it is faced" → "Change begins only when something is faced"
- "You miss 100% of the shots you don't take" → "You make 0% of the shots you skip"
- "Do or do not, there is no try" → "Either take action or refrain completely, as mere attempts fall short"
- "A ship is safe in harbor, but that's not what ships are" → "A ship is safe in harbor, and at the same time ships are built for the open sea"

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:
""",
                    'example': {
                        'from': "I don't want to go",
                        'to': "I prefer to stay"
                    }
                },
                'ability': {
                    'prompt': """
You are a specialized translation assistant that focuses only on improving sentences where negations relate to ability or finding things.

CRITICAL INSTRUCTION:
The transformed sentence MUST NOT contain ANY negative words or constructions whatsoever. This includes: not, no, never, without, isn't, don't, can't, won't, couldn't, wouldn't, shouldn't, unable, impossible, lack of, failed to, hardly, rarely, none, nothing, nowhere, etc. Every single negative construction MUST be replaced with a purely positive alternative.

CONTEXT:
- When expressions like "can't find" or "couldn't locate" are used, they can create friction
- These expressions often get translated in ways that imply incompetence or harsh judgment
- The goal is to transform them into neutral statements that maintain the factual content without any negation

TONE GUIDANCE:
- Avoid implying incompetence, struggle, or undue difficulty
- Use factual, neutral descriptions of the current status
- Preserve the original intent without adding judgment

TRANSFORMATION PATTERNS:
- "can't find" → "still looking for"
- "couldn't locate" → "continuing to search for" 
- "unable to finish" → "need more time to complete"
- "can't understand" → "working to grasp" or "seeking to comprehend"
- "couldn't solve" → "working on alternative solutions"
- "can't see" → "have limited visibility of"
- "can't hear" → "missed hearing"

INSTRUCTIONS:
1. Identify statements about inability to find, locate, accomplish, understand, or perceive something
2. Transform them into factual statements about current status using purely positive language
3. Avoid phrases that imply struggle, incompetence, or judgment
4. CRITICAL: After transformation, verify that NO negative words remain in your answer
5. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I can't find my keys" → "I'm still looking for my keys" (NOT "I struggle to find my keys")
- "She couldn't locate the file" → "She continues to search for the file" 
- "He can't finish the project on time" → "He needs additional time to complete the project"
- "They couldn't solve the problem" → "They're exploring alternative solutions"
- "I can't understand this concept" → "I'm in the process of learning this concept"
- "She can't see the screen from there" → "She needs a better viewing angle for the screen"
- "I couldn't figure out how to use this" → "I'm still learning how to use this effectively"

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:
""",
                    'example': {
                        'from': "I can't find my keys",
                        'to': "I'm still looking for my keys"
                    }
                },
                'state': {
                    'prompt': """
You are a specialized translation assistant that focuses only on improving sentences where negations describe a state of being.

CRITICAL INSTRUCTION:
The transformed sentence MUST NOT contain ANY negative words or constructions whatsoever. This includes: not, no, never, without, isn't, don't, can't, won't, couldn't, wouldn't, shouldn't, unable, impossible, lack of, failed to, hardly, rarely, none, nothing, nowhere, etc. Every single negative construction MUST be replaced with a purely positive alternative.

CONTEXT:
- When 'not' or other negations are used to describe a state (e.g., "I am not happy"), it creates friction
- The goal is to rephrase these to express the actual state in balanced, positive terms

TONE GUIDANCE:
- Match the emotional weight of the original statement (don't escalate or diminish)
- Use precise language without introducing judgment or cynicism
- Maintain neutrality when the original is neutral

TRANSFORMATION PATTERNS:
- "is not X" → "is Y" (opposite or alternative to X)
- "was not present" → "was absent" or "was elsewhere"
- "isn't working" → "needs repair" or "requires adjustment"
- "are not ready" → "need more preparation"
- "am not impressed" → "feel underwhelmed"

INSTRUCTIONS:
1. Identify the state being negated in the sentence
2. Transform it into a balanced description of the actual state using purely positive language
3. Use specific, precise language that captures the meaning without judgment
4. CRITICAL: After transformation, verify that NO negative words remain in your answer
5. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I am not happy" → "I am disappointed" (not "I am devastated" - match the intensity)
- "I am not there" → "I am elsewhere"
- "This is not working" → "This requires repair"
- "I'm not feeling well" → "I'm feeling under the weather"
- "She was not present" → "She was absent"
- "He isn't satisfied" → "He desires additional improvements"
- "They weren't prepared" → "They needed more preparation time"
- "I'm not sure" → "I'm uncertain"
- "This isn't what I expected" → "This differs from my expectations"

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:
""",
                    'example': {
                        'from': "I am not there",
                        'to': "I am elsewhere"
                    }
                },
                'determiner': {
                    'prompt': """
You are a specialized translation assistant that focuses only on improving sentences containing 'no' used as a determiner.

CRITICAL INSTRUCTION:
The transformed sentence MUST NOT contain ANY negative words or constructions whatsoever. This includes: not, no, never, without, isn't, don't, can't, won't, couldn't, wouldn't, shouldn't, unable, impossible, lack of, failed to, hardly, rarely, none, nothing, nowhere, etc. Every single negative construction MUST be replaced with a purely positive alternative.

CONTEXT:
- When 'no' is used as a determiner before a noun (e.g., "no graven image"), it creates friction in communication
- The goal is to rephrase sentences to express what should be done instead in constructive, positive terms

TONE GUIDANCE:
- Use neutral or positive language that avoids judgment
- Maintain the emotional weight and intent of the original
- Avoid introducing harshness or absolutism not present in the original

TRANSFORMATION PATTERNS:
- "no X" → "zero X" or "an absence of X"
- "no way" → "completely unfeasible" or "beyond current possibilities"
- "no money" → "zero funds" or "empty accounts"
- "no interest" → "complete disinterest" or "focus on other areas"
- "no choice" → "only one option" or "a single path forward"

INSTRUCTIONS:
1. Identify the noun that follows 'no' in the sentence
2. Rephrase the sentence to express what is true or should be done instead regarding that noun
3. Use constructive language that maintains the original meaning without any negative words
4. CRITICAL: After transformation, verify that NO negative words remain in your answer
5. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "Thou shalt create no graven image" → "Thou shalt refrain from creating graven images"
- "There is no way to do this" → "This appears to be completely unfeasible"
- "I have no money" → "My accounts are empty"
- "He showed no emotion" → "He maintained a neutral expression"
- "She has no interest in the subject" → "She prefers to focus on other subjects"
- "We have no time left" → "Our time has completely expired"
- "There is no evidence" → "Evidence remains completely absent"
- "He gave me no choice" → "He left me with only one option"

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:
""",
                    'example': {
                        'from': "Thou shalt create no graven image",
                        'to': "Thou shalt refrain from creating graven images"
                    }
                },
                'complex': {
                    'prompt': """
You are a specialized translation assistant that focuses on improving complex multi-part sentences containing multiple negative constructions.

CRITICAL INSTRUCTION:
The transformed text MUST NOT contain ANY negative words or constructions whatsoever. This includes: not, no, never, without, isn't, don't, can't, won't, couldn't, wouldn't, shouldn't, unable, impossible, lack of, failed to, hardly, rarely, none, nothing, nowhere, etc. Every single negative construction MUST be replaced with a purely positive alternative.

CONTEXT:
- Long sentences with multiple negations create significant friction in communication
- Sequential negative sentences can lose coherence when translated individually
- The goal is to transform the entire message while maintaining coherence and eliminating all negative language

TONE GUIDANCE:
- Maintain a balanced, neutral tone throughout the transformation
- Preserve the emotional weight of the original without escalation
- Avoid introducing judgment, cynicism, or harshness not present in the original
- For ability statements, avoid implying incompetence or struggle
- For preference statements, focus on actual preferences without exaggeration

TRANSFORMATION STRATEGY:
1. First identify ALL negative constructions in the text
2. Plan replacements that maintain logical connections between ideas
3. Replace each negative construction systematically with positive alternatives
4. Ensure the overall meaning and emotional tone stays consistent

INSTRUCTIONS:
1. Analyze the entire text, identifying ALL negative constructions
2. Transform EACH negative expression systematically, working from beginning to end
3. Ensure the transformations maintain logical flow and coherence between parts
4. Apply the tone guidance consistently to each transformation
5. For long passages, pay special attention to the later sentences - don't leave any untransformed
6. CRITICAL: After transformation, verify that NO negative words remain in your answer
7. Return the COMPLETE transformed text without skipping any sections

EXAMPLES:
- "I don't want to go and I won't enjoy it if I do" → "I prefer to stay and I'll feel uncomfortable if I attend"
- "No, I'm not interested and I don't have time" → "I lack interest and my schedule is full"
- "I hit one of the worst shots and I haven't played well all day" → "I hit a poor shot and I've played below my standard today"
- "She wasn't happy and didn't want to continue" → "She felt disappointed and wanted to stop"
- "I have not failed. I've just found 10,000 ways that won't work." → "I have succeeded differently. I've discovered 10,000 approaches that taught me valuable lessons."
- "Not everything that is faced can be changed, but nothing can be changed until it is faced." → "Some things we face remain the same, and at the same time, change begins only when something is faced."

TEXT TO TRANSFORM:
{text}

TRANSFORMED TEXT:
""",
                    'example': {
                        'from': "I have not failed. I've just found 10,000 ways that won't work.",
                        'to': "I have succeeded differently. I've discovered 10,000 approaches that taught me valuable lessons."
                    }
                }
            }
        }
    
    def _load_prompts(self):
        """Load prompts from JSON file."""
        try:
            if os.path.exists(self.prompts_file):
                with open(self.prompts_file, 'r') as f:
                    return json.load(f)
            else:
                # Return empty prompts dict if file doesn't exist
                return {}
        except Exception as e:
            print(f"Error loading prompts: {e}")
            return {}
    
    def save_prompts(self):
        """Save prompts to JSON file."""
        try:
            with open(self.prompts_file, 'w') as f:
                json.dump(self.prompts, f, indent=2)
            return True
        except Exception as e:
            print(f"Error saving prompts: {e}")
            return False
    
    def get_prompt_for_word(self, word, context=None):
        """
        Get prompt for a specific word and context.
        
        Args:
            word (str): The friction word or context name
            context (str, optional): Context type. Defaults to None.
            
        Returns:
            dict: Prompt configuration or None if not found
        """
        # Special case handling for ability, state, determiner contexts
        if word in ['ability', 'state', 'determiner', 'complex']:
            # Check if this context exists in 'not' word type
            if 'not' in self.prompts and word in self.prompts['not']:
                return self.prompts['not'][word]
            elif 'not' in self.default_prompts and word in self.default_prompts['not']:
                return self.default_prompts['not'][word]
            return None
        
        word_type = self._get_word_type(word)
        if not word_type:
            return None
        
        # Try to get from saved prompts
        if word_type in self.prompts:
            word_prompts = self.prompts[word_type]
            
            # First try with specific context
            if context and context in word_prompts:
                return word_prompts[context]
            
            # Then try with default context
            if 'default' in word_prompts:
                return word_prompts['default']
        
        # If not found in saved prompts, try default prompts
        if word_type in self.default_prompts:
            # First try with specific context
            if context and context in self.default_prompts[word_type]:
                return self.default_prompts[word_type][context]
            
            # Then try with default context
            if 'default' in self.default_prompts[word_type]:
                return self.default_prompts[word_type]['default']
        
        return None
    
    def _get_word_type(self, word):
        """Determine the type of the friction word."""
        word = word.lower()
        
        if word in ['but', 'yet']:
            return 'but'
        
        if word in ['should', 'shouldn\'t', 'could', 'couldn\'t', 'would', 'wouldn\'t'] or 'need to' in word:
            return 'should'
        
        if word in ['not', 'never', 'without', 'no', 'none', 'nobody', 'nothing', 'nowhere', 
                   'don\'t', 'won\'t', 'can\'t', 'didn\'t', 'isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t',
                   'doesn\'t', 'haven\'t', 'hasn\'t', 'hadn\'t', 'couldn\'t', 'wouldn\'t', 'shouldn\'t',
                   'shan\'t', 'mustn\'t', 'mightn\'t', 'mayn\'t', 'ain\'t']:
            return 'not'
        
        # If it's not an exact match, check for patterns
        if re.search(r'n\'t$', word) or re.search(r' not$', word):
            return 'not'
        
        return None
    
    def set_prompt(self, word_type, context, prompt, example=None):
        """
        Set a custom prompt for a word type and context.
        
        Args:
            word_type (str): Type of word ('should', 'but', or 'not')
            context (str): Context name
            prompt (str): Prompt template with {text} placeholder
            example (dict, optional): Example with 'from' and 'to'. Defaults to None.
            
        Returns:
            bool: Success or failure
        """
        if word_type not in ['should', 'but', 'not']:
            return False
        
        # Initialize word type if not exists
        if word_type not in self.prompts:
            self.prompts[word_type] = {}
        
        # Set prompt
        self.prompts[word_type][context] = {
            'prompt': prompt
        }
        
        # Set example if provided
        if example and isinstance(example, dict) and 'from' in example and 'to' in example:
            self.prompts[word_type][context]['example'] = example
        
        # Save to file
        return self.save_prompts()
    
    def get_all_prompts(self):
        """Get all prompts."""
        # Combine default prompts with custom prompts
        all_prompts = {}
        
        # Start with default prompts
        for word_type, contexts in self.default_prompts.items():
            all_prompts[word_type] = {}
            for context, prompt_data in contexts.items():
                all_prompts[word_type][context] = prompt_data
        
        # Override with custom prompts
        for word_type, contexts in self.prompts.items():
            if word_type not in all_prompts:
                all_prompts[word_type] = {}
            for context, prompt_data in contexts.items():
                all_prompts[word_type][context] = prompt_data
        
        return all_prompts