"""
Real-Time Friction Language Analyzer
This extends the existing translator functionality to provide real-time analysis
without modifying the original text.
"""

import re
import json
import logging
from processor.sentence_parser import SentenceParser

class RealTimeAnalyzer:
    """
    Analyzes text in real-time to identify friction language without changing it.
    Uses the existing translators to identify and generate alternatives.
    """
    
    def __init__(self, text_processor):
        """
        Initialize the real-time analyzer.
        
        Args:
            text_processor: The existing TextProcessor instance with translators
        """
        self.text_processor = text_processor
        self.sentence_parser = SentenceParser()
        self.logger = logging.getLogger('real_time_analyzer')
    
    def analyze_text(self, text):
        """
        Analyze the text to identify friction language points.
        
        Args:
            text (str): The text to analyze
            
        Returns:
            list: A list of friction points with their positions and alternatives
        """
        if not text:
            return []
            
        self.logger.debug(f"Analyzing text: {repr(text[:100])}...")
        
        # Parse the text into sentences
        sentences = self.sentence_parser.parse(text)
        
        # Track all friction points
        friction_points = []
        
        # Keep track of the character position in the original text
        current_pos = 0
        
        for sentence in sentences:
            # Find the actual position of this sentence in the original text
            sentence_start = text.find(sentence, current_pos)
            if sentence_start == -1:
                # If exact match not found, try to find similar text
                continue
                
            sentence_end = sentence_start + len(sentence)
            current_pos = sentence_end  # Update for next search
            
            # Process sentence with each translator to identify friction points
            friction_points.extend(self._check_but_friction(text, sentence, sentence_start))
            friction_points.extend(self._check_should_friction(text, sentence, sentence_start))
            friction_points.extend(self._check_not_friction(text, sentence, sentence_start))
        
        # Sort friction points by their position in the text
        friction_points.sort(key=lambda x: x['start_pos'])
        
        self.logger.debug(f"Found {len(friction_points)} friction points")
        
        return friction_points
    
    def _check_but_friction(self, full_text, sentence, sentence_start):
        """
        Check for 'but' and 'yet' friction in a sentence.
        
        Args:
            full_text (str): The complete text
            sentence (str): The sentence to check
            sentence_start (int): The start position of the sentence in the full text
            
        Returns:
            list: Friction points found in this sentence
        """
        friction_points = []
        
        # Check if sentence contains 'but' friction
        if not self.text_processor.but_translator.contains_but_or_yet(sentence):
            return friction_points
            
        # Process with but translator but don't replace yet
        translated = self.text_processor.but_translator.translate(sentence)
        
        # If no change, no friction points to report
        if translated == sentence:
            return friction_points
            
        # Find all 'but' and 'yet' instances in the sentence
        patterns = [r'\bbut\b', r'\byet\b']
        
        for pattern in patterns:
            for match in re.finditer(pattern, sentence, re.IGNORECASE):
                word_start = sentence_start + match.start()
                word_end = sentence_start + match.end()
                original_word = match.group(0)
                
                # Figure out what it was replaced with
                if original_word.lower() == 'but':
                    replacement = 'and at the same time'
                    suggestion = "Consider replacing 'but' with 'and at the same time' to give equal weight to both parts of the sentence."
                else:  # 'yet'
                    replacement = 'and at the same time'
                    suggestion = "Consider replacing 'yet' with 'and at the same time' to avoid minimizing what comes before it."
                    
                # Get context
                context_start = max(0, word_start - 20)
                context_end = min(len(full_text), word_end + 20)
                context = full_text[context_start:context_end]
                
                # Add to friction points
                friction_points.append({
                    'type': 'but',
                    'start_pos': word_start,
                    'end_pos': word_end,
                    'original': original_word,
                    'replacement': replacement,
                    'context': context,
                    'suggestion': suggestion
                })
                
        return friction_points
    
    def _check_should_friction(self, full_text, sentence, sentence_start):
        """
        Check for 'should', 'could', 'would' friction in a sentence.
        
        Args:
            full_text (str): The complete text
            sentence (str): The sentence to check
            sentence_start (int): The start position of the sentence in the full text
            
        Returns:
            list: Friction points found in this sentence
        """
        friction_points = []
        
        # Check if sentence contains modal verb friction
        if not self.text_processor.should_translator.contains_modal_verbs(sentence):
            return friction_points
            
        # Process with should translator but don't replace yet
        translated = self.text_processor.should_translator.translate(sentence)
        
        # If no change, no friction points to report
        if translated == sentence:
            return friction_points
            
        # Check for each modal verb pattern
        patterns = [
            r'\bshould\b', r'\bshouldn\'t\b', 
            r'\bcould\b', r'\bcouldn\'t\b', 
            r'\bwould\b', r'\bwouldn\'t\b',
            r'\bwe need to\b'
        ]
        
        for pattern in patterns:
            for match in re.finditer(pattern, sentence, re.IGNORECASE):
                word_start = sentence_start + match.start()
                word_end = sentence_start + match.end()
                original_word = match.group(0)
                
                # Determine replacement based on word
                if original_word.lower() == 'should':
                    replacement = 'might'
                    suggestion = "Consider using 'might' instead of 'should' to reduce the sense of obligation."
                elif original_word.lower() == 'shouldn\'t':
                    replacement = 'might not want to'
                    suggestion = "Consider using 'might not want to' instead of 'shouldn't' to reduce the sense of prohibition."
                elif original_word.lower() == 'could':
                    replacement = 'might be able to'
                    suggestion = "Consider using 'might be able to' instead of 'could' for a more open possibility."
                elif original_word.lower() == 'couldn\'t':
                    replacement = 'might not be able to'
                    suggestion = "Consider using 'might not be able to' instead of 'couldn't' to focus on possibility."
                elif original_word.lower() == 'would':
                    replacement = 'might'
                    suggestion = "Consider using 'might' instead of 'would' to reduce certainty and create openness."
                elif original_word.lower() == 'wouldn\'t':
                    replacement = 'might not'
                    suggestion = "Consider using 'might not' instead of 'wouldn't' to reduce certainty."
                elif original_word.lower() == 'we need to':
                    replacement = 'it would be beneficial to'
                    suggestion = "Consider using 'it would be beneficial to' instead of 'we need to' to reduce imperative tone."
                else:
                    replacement = original_word  # fallback
                    suggestion = f"Consider replacing '{original_word}' with a less forceful alternative."
                
                # Get context
                context_start = max(0, word_start - 20)
                context_end = min(len(full_text), word_end + 20)
                context = full_text[context_start:context_end]
                
                # Add to friction points
                friction_points.append({
                    'type': 'should',
                    'start_pos': word_start,
                    'end_pos': word_end,
                    'original': original_word,
                    'replacement': replacement,
                    'context': context,
                    'suggestion': suggestion
                })
                
        return friction_points
    
    def _check_not_friction(self, full_text, sentence, sentence_start):
        """
        Check for negative construction friction in a sentence.
        
        Args:
            full_text (str): The complete text
            sentence (str): The sentence to check
            sentence_start (int): The start position of the sentence in the full text
            
        Returns:
            list: Friction points found in this sentence
        """
        friction_points = []
        
        # Check if sentence contains negative construction friction
        if not self.text_processor.not_translator.contains_negation(sentence):
            return friction_points
            
        # Process with not translator but don't replace yet
        translated = self.text_processor.not_translator.translate(sentence)
        
        # If no change, no friction points to report
        if translated == sentence:
            return friction_points
            
        # Check for each negative pattern
        patterns = self.text_processor.not_translator.not_patterns
        
        for pattern in patterns:
            for match in re.finditer(pattern, sentence, re.IGNORECASE):
                word_start = sentence_start + match.start()
                word_end = sentence_start + match.end()
                original_word = match.group(0)
                
                # Generate an appropriate replacement based on the negative word
                # This is simplified - ideally we would extract from the translated version
                if original_word.lower() == 'not':
                    replacement = ''  # Will need to be determined by context
                    suggestion = "Consider replacing the negative construction with a positive statement."
                elif original_word.lower() == 'never':
                    replacement = 'rarely'
                    suggestion = "Consider using 'rarely' instead of 'never' to acknowledge possibilities."
                elif original_word.lower() == 'without':
                    replacement = 'lacking'
                    suggestion = "Consider using 'lacking' instead of 'without' for a more neutral tone."
                elif original_word.lower() == 'no':
                    replacement = 'few'
                    suggestion = "Consider using 'few' instead of 'no' to allow for exceptions."
                elif original_word.lower() == 'isn\'t' or original_word.lower() == 'is not':
                    replacement = 'differs from'
                    suggestion = "Consider using 'differs from' instead of 'isn't' to focus on what is true."
                elif original_word.lower() == 'aren\'t' or original_word.lower() == 'are not':
                    replacement = 'differ from'
                    suggestion = "Consider using 'differ from' instead of 'aren't' to focus on what is true."
                elif original_word.lower() == 'can\'t' or original_word.lower() == 'cannot':
                    replacement = 'am still working to'
                    suggestion = "Consider using 'am still working to' instead of 'can't' to focus on progress."
                elif original_word.lower() == 'don\'t' or original_word.lower() == 'do not':
                    replacement = 'prefer to avoid'
                    suggestion = "Consider using 'prefer to avoid' instead of 'don't' to express preference rather than negation."
                else:
                    # For other patterns, we'll use a generic replacement
                    replacement = 'positive alternative'
                    suggestion = f"Consider replacing '{original_word}' with a positive alternative."
                
                # Get context
                context_start = max(0, word_start - 20)
                context_end = min(len(full_text), word_end + 20)
                context = full_text[context_start:context_end]
                
                # Add to friction points
                friction_points.append({
                    'type': 'not',
                    'start_pos': word_start,
                    'end_pos': word_end,
                    'original': original_word,
                    'replacement': replacement,
                    'context': context,
                    'suggestion': suggestion
                })
                
        return friction_points
    
    def generate_alternatives(self, type, text):
        """
        Generate alternative suggestions for a friction word.
        
        Args:
            type (str): The friction type ('but', 'should', 'not')
            text (str): The original friction text
            
        Returns:
            list: Alternative replacements
        """
        self.logger.debug(f"Generating alternatives for type: {type}, text: {text}")
        
        alternatives = []
        
        if type == 'but':
            # Alternatives for 'but' and 'yet'
            if text.lower() == 'but':
                alternatives = [
                    'and at the same time',
                    'and',
                    'while',
                    'although',
                    'however'
                ]
            elif text.lower() == 'yet':
                alternatives = [
                    'and at the same time',
                    'simultaneously',
                    'although',
                    'while',
                    'nevertheless'
                ]
        
        elif type == 'should':
            # Alternatives for modal verbs
            if text.lower() == 'should':
                alternatives = [
                    'might',
                    'could consider',
                    'I recommend',
                    'I suggest',
                    'may want to'
                ]
            elif text.lower() == 'shouldn\'t':
                alternatives = [
                    'might not want to',
                    'I recommend against',
                    'could reconsider',
                    'may want to avoid',
                    'consider not'
                ]
            elif text.lower() == 'could':
                alternatives = [
                    'might',
                    'have the ability to',
                    'are capable of',
                    'have an opportunity to',
                    'have the option to'
                ]
            elif text.lower() == 'couldn\'t':
                alternatives = [
                    'might not be able to',
                    'were having difficulty with',
                    'were still working on',
                    'have yet to',
                    'still need to'
                ]
            elif text.lower() == 'would':
                alternatives = [
                    'might',
                    'could',
                    'tend to',
                    'typically',
                    'often'
                ]
            elif text.lower() == 'wouldn\'t':
                alternatives = [
                    'might not',
                    'prefer not to',
                    'tend to avoid',
                    'usually skip',
                    'often avoid'
                ]
            elif text.lower() == 'we need to':
                alternatives = [
                    'it would be beneficial to',
                    'we would benefit from',
                    'it helps to',
                    'its valuable to',
                    'we benefit when we'
                ]
        
        elif type == 'not':
            # Alternatives for negative constructions
            # This is a simplified version - ideally we would use more context
            if text.lower() == 'not':
                alternatives = [
                    'instead',
                    'rather',
                    'differently',
                    'contrarily',
                    'alternatively'
                ]
            elif text.lower() == 'never':
                alternatives = [
                    'rarely',
                    'seldom',
                    'infrequently',
                    'almost never',
                    'hardly ever'
                ]
            elif text.lower() == 'without':
                alternatives = [
                    'lacking',
                    'missing',
                    'in the absence of',
                    'free from',
                    'independent of'
                ]
            elif text.lower() == 'no':
                alternatives = [
                    'few',
                    'minimal',
                    'limited',
                    'a lack of',
                    'an absence of'
                ]
            elif text.lower() == 'isn\'t' or text.lower() == 'is not':
                alternatives = [
                    'differs from',
                    'contrasts with',
                    'varies from',
                    'is distinct from',
                    'is separate from'
                ]
            elif text.lower() == 'aren\'t' or text.lower() == 'are not':
                alternatives = [
                    'differ from',
                    'contrast with',
                    'vary from',
                    'are distinct from',
                    'are separate from'
                ]
            elif text.lower() == 'can\'t' or text.lower() == 'cannot':
                alternatives = [
                    'am still working to',
                    'am continuing to try to',
                    'need assistance to',
                    'am looking for ways to',
                    'am seeking help to'
                ]
            elif text.lower() == 'don\'t' or text.lower() == 'do not':
                alternatives = [
                    'prefer to avoid',
                    'choose to skip',
                    'would rather',
                    'prefer alternatives to',
                    'opt out of'
                ]
            elif text.lower() == 'didn\'t' or text.lower() == 'did not':
                alternatives = [
                    'missed the opportunity to',
                    'forgot to',
                    'overlooked',
                    'bypassed',
                    'chose to skip'
                ]
            else:
                # Generic alternatives for other negative constructions
                alternatives = [
                    'positive alternative 1',
                    'positive alternative 2',
                    'positive alternative 3'
                ]
        
        # Limit to at most 3 alternatives
        return alternatives[:3]