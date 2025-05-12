import re
import os
from processor.translators.should_translator import ShouldTranslator
from processor.translators.but_translator import ButTranslator
from processor.translators.not_translator import NotTranslator
from processor.sentence_parser import SentenceParser
from prompt_manager import PromptManager
import difflib

class TextProcessor:
    def __init__(self, api_key=None, endpoint=None):
        """
        Initialize the TextProcessor with all Azure OpenAI-based translators.
        
        Args:
            api_key (str, optional): API key for Azure OpenAI. Defaults to environment variable.
            endpoint (str, optional): Azure OpenAI endpoint. Defaults to environment variable.
        """
        # Get API key and endpoint from environment if not provided
        self.api_key = api_key or os.environ.get('AZURE_OPENAI_API_KEY')
        self.endpoint = endpoint or os.environ.get('AZURE_OPENAI_ENDPOINT')
        
        if not self.api_key:
            raise ValueError("No API key provided. Set AZURE_OPENAI_API_KEY environment variable or pass as parameter.")
            
        if not self.endpoint:
            raise ValueError("No endpoint provided. Set AZURE_OPENAI_ENDPOINT environment variable or pass as parameter.")
        
        # Initialize prompt manager and sentence parser
        self.prompt_manager = PromptManager()
        self.sentence_parser = SentenceParser()
        
        # Initialize LLM-based translators with Azure OpenAI credentials
        self.should_translator = ShouldTranslator(self.prompt_manager, self.api_key, self.endpoint)
        self.but_translator = ButTranslator(self.api_key, self.endpoint)
        self.not_translator = NotTranslator(self.prompt_manager, self.api_key, self.endpoint)
        
        # Track changes for reporting
        self.changes = []
        # Track friction words and their replacements
        self.friction_words = []
        # Track specific transformations
        self.transformations = []
        
        # Define friction word patterns for detection (used for reporting)
        self.should_patterns = [
            r'\bshould\b', r'\bshouldn\'t\b', r'\bcould\b', r'\bcouldn\'t\b',
            r'\bwould\b', r'\bwouldn\'t\b', r'\bwe\s+need\s+to\b'
        ]
        
        self.but_patterns = [r'\bbut\b', r'\byet\b']
        
        self.not_patterns = [
            r'\bnot\b', r'\bnever\b', r'\bwithout\b', r'\bno\b', r'\bnothing\b',
            r'\bdon\'t\b', r'\bwon\'t\b', r'\bcan\'t\b', r'\bcannot\b',
            r'\bisn\'t\b', r'\baren\'t\b', r'\bwasn\'t\b', r'\bweren\'t\b',
            r'\bdoesn\'t\b', r'\bdidn\'t\b', r'\bhaven\'t\b', r'\bhasn\'t\b',
            r'\bhadn\'t\b', r'\bcouldn\'t\b', r'\bwouldn\'t\b', r'\bshouldn\'t\b',
            r'\bmustn\'t\b', r'\bain\'t\b', r'\bnone\b', r'\bnobody\b', r'\bnowhere\b'
        ]
    
    def process_text(self, text, highlight_changes=False):
        """
        Process the full text by preserving paragraph structure while processing each sentence.
        Works universally for any type of paragraph without skipping any text.
        
        Args:
            text (str): Text to process
            highlight_changes (bool, optional): Whether to highlight changes in the result. Defaults to False.
            
        Returns:
            tuple: (processed_text, changes_list, highlighted_text if highlight_changes=True)
        """
        # IMPORTANT: Normalize curly apostrophes and quotes to their straight equivalents at the beginning
        text = text.replace("’", "'").replace("‘", "'")
        text = text.replace("“", '"').replace("”", '"')
        
        # Reset changes, friction words, and transformations
        self.changes = []
        self.friction_words = []
        self.transformations = []
        
        # Skip if empty
        if not text:
            return (text, self.changes, text) if highlight_changes else (text, self.changes)
        
        # Debug information
        print(f"PROCESSING RAW TEXT: {repr(text)}")
        
        # Add ending periods to sentences if missing, but preserve newlines
        # This helps with sentence detection for fragments without periods
        text = self._ensure_sentence_endings(text)
        
        # Split into paragraphs to preserve structure
        paragraphs = text.split('\n')
        processed_paragraphs = []
        original_paragraphs = [] if highlight_changes else None
        
        # Process each paragraph
        for paragraph in paragraphs:
            if not paragraph.strip():
                # Preserve empty lines
                processed_paragraphs.append('')
                if highlight_changes:
                    original_paragraphs.append('')
                continue
            
            # Break paragraph into sentences for better LLM processing
            segments = self.sentence_parser.parse(paragraph)
            print(f"PARSED SEGMENTS: {segments}")
            
            if not segments:
                # If no segments were found (unusual case), add the paragraph as-is
                processed_paragraphs.append(paragraph)
                if highlight_changes:
                    original_paragraphs.append(paragraph)
                continue
            
            # Process each segment (sentence)
            processed_segments = []
            original_segments = [] if highlight_changes else None
            
            for segment in segments:
                if segment.strip():
                    if highlight_changes:
                        original_segments.append(segment)
                    
                    processed, segment_changes = self.process_sentence(segment)
                    
                    # Check if this segment is too similar to any we've already processed
                    # Only add it if it's not a duplicate
                    if not any(self._is_similar_sentence(processed, existing) for existing in processed_segments):
                        processed_segments.append(processed)
                        self.changes.extend(segment_changes)
                    else:
                        print(f"Detected duplicate segment, skipping: '{processed}'")
            
            # Recombine the processed segments into a paragraph
            processed_paragraph = ' '.join(segment.strip() for segment in processed_segments)
            processed_paragraphs.append(processed_paragraph)
            
            if highlight_changes:
                original_paragraph = ' '.join(original_segments)
                original_paragraphs.append(original_paragraph)
        
        # Recombine paragraphs with line breaks
        processed_text = '\n'.join(processed_paragraphs)
        
        # Extract friction words and their replacements for reporting
        self._extract_friction_words(text, processed_text)
        
        if highlight_changes:
            original_text = '\n'.join(original_paragraphs)
            highlighted_text = self.highlight_changes_inline(original_text, processed_text)
            return processed_text, self.changes, highlighted_text
        else:
            return processed_text, self.changes
    
    def _ensure_sentence_endings(self, text):
        """
        Ensure all sentences have proper endings for better sentence parsing.
        Adds periods to sentence fragments that don't end with punctuation.
        
        Args:
            text (str): Text to process
            
        Returns:
            str: Text with sentence endings normalized
        """
        # Pattern to find sentence fragments without proper ending punctuation
        # but preserving newlines and respecting existing punctuation
        lines = text.split('\n')
        processed_lines = []
        
        for line in lines:
            # Skip empty lines
            if not line.strip():
                processed_lines.append(line)
                continue
                
            # Process each line to ensure sentences end with punctuation
            segments = re.split(r'([.!?;])', line)
            processed_segments = []
            
            # Add each segment with its punctuation if it exists
            for i in range(0, len(segments)-1, 2):
                processed_segments.append(segments[i] + segments[i+1])
                
            # Handle the last segment if it doesn't have punctuation
            if len(segments) % 2 == 1 and segments[-1].strip():
                last_segment = segments[-1].strip()
                if not re.search(r'[.!?;]$', last_segment):
                    processed_segments.append(last_segment + '.')
                else:
                    processed_segments.append(last_segment)
                    
            processed_lines.append(''.join(processed_segments))
            
        return '\n'.join(processed_lines)
    
    def _is_similar_sentence(self, sentence1, sentence2):
        """Check if two sentences are very similar to avoid duplication."""
        # Normalize for comparison
        s1 = self._normalize_text(sentence1)
        s2 = self._normalize_text(sentence2)
        
        # Check for near-identical match
        if s1 == s2:
            return True
        
        # Check for one being a subset of the other
        if s1 in s2 or s2 in s1:
            return True
        
        # Use difflib to check similarity ratio
        similarity = difflib.SequenceMatcher(None, s1, s2).ratio()
        # If more than 80% similar, consider them duplicates
        return similarity > 0.8
    
    def process_sentence(self, sentence):
        """
        Process a single sentence by applying translators in sequence.
        Modified to apply multiple translators per sentence to handle complex cases.
        
        Returns:
            tuple: (processed_sentence, changes_list)
        """
        original = sentence
        processed_sentence = sentence
        changes = []
        
        print(f"\n==== Processing sentence: '{sentence}' ====")
        
        # IMPORTANT CHANGE: Apply all translators in sequence, processing the result of each
        # This allows handling sentences with multiple types of friction language
        
        # First, detect all friction types in the sentence
        has_but_words = any(re.search(pattern, processed_sentence, re.IGNORECASE) for pattern in self.but_patterns)
        has_should_words = any(re.search(pattern, processed_sentence, re.IGNORECASE) for pattern in self.should_patterns)
        has_not_words = any(re.search(pattern, processed_sentence, re.IGNORECASE) for pattern in self.not_patterns)
        
        # Apply BUT translator first (if needed)
        if has_but_words:
            print(f"BUT friction words detected. Applying BUT translator...")
            but_result = self.but_translator.translate(processed_sentence)
            print(f"BUT translator result: '{but_result}'")
            if but_result != processed_sentence:
                changes.append({
                    'type': 'but',
                    'original': processed_sentence,
                    'translated': but_result,
                    'explanation': 'Replaced "but" type friction language using Azure OpenAI'
                })
                
                # Track specific transformations using diff
                self._track_specific_transformations('but', processed_sentence, but_result)
                print(f"BUT change detected: '{processed_sentence}' -> '{but_result}'")
                
                # Update sentence for next translator
                processed_sentence = but_result
            else:
                print(f"No BUT changes detected")
        else:
            print(f"No BUT friction words detected. Skipping BUT translator.")
        
        # Apply SHOULD translator (on updated text)
        # Check again since previous translation might have affected this
        has_should_words = any(re.search(pattern, processed_sentence, re.IGNORECASE) for pattern in self.should_patterns)
        if has_should_words:
            print(f"SHOULD friction words detected. Applying SHOULD translator...")
            should_result = self.should_translator.translate(processed_sentence)
            print(f"SHOULD translator result: '{should_result}'")
            if should_result != processed_sentence:
                changes.append({
                    'type': 'should',
                    'original': processed_sentence,
                    'translated': should_result,
                    'explanation': 'Replaced "should" type friction language using Azure OpenAI'
                })
                
                # Track specific transformations using diff
                self._track_specific_transformations('should', processed_sentence, should_result)
                print(f"SHOULD change detected: '{processed_sentence}' -> '{should_result}'")
                
                # Update sentence for next translator
                processed_sentence = should_result
            else:
                print(f"No SHOULD changes detected")
        else:
            print(f"No SHOULD friction words detected. Skipping SHOULD translator.")
        
        # Apply NOT translator (on updated text)
        # Check again since previous translations might have affected this
        has_not_words = any(re.search(pattern, processed_sentence, re.IGNORECASE) for pattern in self.not_patterns)
        if has_not_words:
            print(f"NOT friction words detected. Applying NOT translator...")
            not_result = self.not_translator.translate(processed_sentence)
            print(f"NOT translator result: '{not_result}'")
            if not_result != processed_sentence:
                changes.append({
                    'type': 'not',
                    'original': processed_sentence,
                    'translated': not_result,
                    'explanation': 'Replaced "not" type friction language using Azure OpenAI'
                })
                
                # Track specific transformations using diff
                self._track_specific_transformations('not', processed_sentence, not_result)
                print(f"NOT change detected: '{processed_sentence}' -> '{not_result}'")
                
                # Update final processed sentence
                processed_sentence = not_result
            else:
                print(f"No NOT changes detected")
        else:
            print(f"No NOT friction words detected. Skipping NOT translator.")
        
        # Check for remaining friction words after all translations
        remaining_friction = self._check_for_remaining_friction(processed_sentence)
        if remaining_friction:
            print(f"WARNING: Sentence still contains friction words after processing: {remaining_friction}")
        
        # If no changes were made, return the original sentence
        if not changes:
            print(f"No friction words detected or no changes made. Returning original sentence.")
            return original, changes
        
        print(f"Final processed result: '{processed_sentence}'")
        return processed_sentence, changes
    
    def _check_for_remaining_friction(self, processed_text):
        """
        Check for any remaining friction words after all translators have been applied.
        Useful for debugging and quality monitoring.
        
        Args:
            processed_text (str): The processed text to check
            
        Returns:
            list: List of remaining friction words found
        """
        remaining = []
        
        # Check for "but" friction words
        for pattern in self.but_patterns:
            matches = re.finditer(pattern, processed_text, re.IGNORECASE)
            for match in matches:
                remaining.append(match.group(0))
        
        # Check for "should" friction words
        for pattern in self.should_patterns:
            matches = re.finditer(pattern, processed_text, re.IGNORECASE)
            for match in matches:
                remaining.append(match.group(0))
        
        # Check for "not" friction words
        for pattern in self.not_patterns:
            matches = re.finditer(pattern, processed_text, re.IGNORECASE)
            for match in matches:
                remaining.append(match.group(0))
        
        return remaining
    
    def _track_specific_transformations(self, translation_type, original, translated):
        """
        Track specific word transformations using difflib.
        
        Args:
            translation_type (str): Type of translation (but, should, not)
            original (str): Original sentence
            translated (str): Translated sentence
        """
        # Split into words for finer comparison
        original_words = original.split()
        translated_words = translated.split()
        
        # Use difflib to find differences
        matcher = difflib.SequenceMatcher(None, original_words, translated_words)
        
        # Process the diff operations
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag in ['replace', 'delete']:
                # These are the words that were changed or removed
                original_phrase = ' '.join(original_words[i1:i2])
                
                # Get the corresponding replacement if it exists
                if tag == 'replace':
                    replacement_phrase = ' '.join(translated_words[j1:j2])
                else:  # for 'delete' operations
                    replacement_phrase = ""
                
                # Try to identify which friction pattern was matched
                friction_type = self._identify_friction_pattern(original_phrase, translation_type)
                
                # Add to transformations list if we have a valid friction word
                if friction_type:
                    self.transformations.append({
                        'type': translation_type,
                        'pattern': friction_type,
                        'original': original_phrase,
                        'replacement': replacement_phrase,
                        'context': self._get_context(original, original_phrase)
                    })
    
    def _identify_friction_pattern(self, phrase, translation_type):
        """
        Identify the specific friction word pattern that was matched.
        
        Args:
            phrase (str): The phrase to check
            translation_type (str): Type of translation (but, should, not)
            
        Returns:
            str: The matched pattern or None
        """
        if translation_type == 'but':
            for pattern in self.but_patterns:
                match = re.search(pattern, phrase, re.IGNORECASE)
                if match:
                    return match.group(0)
        
        elif translation_type == 'should':
            for pattern in self.should_patterns:
                match = re.search(pattern, phrase, re.IGNORECASE)
                if match:
                    return match.group(0)
        
        elif translation_type == 'not':
            for pattern in self.not_patterns:
                match = re.search(pattern, phrase, re.IGNORECASE)
                if match:
                    return match.group(0)
        
        return None
    
    def _get_context(self, sentence, phrase):
        """
        Get a small context around the friction phrase.
        
        Args:
            sentence (str): The full sentence
            phrase (str): The friction phrase
            
        Returns:
            str: A context snippet
        """
        # Find position of phrase in sentence
        pos = sentence.find(phrase)
        if pos == -1:
            return sentence  # Fallback to full sentence if not found
        
        # Get some words before and after
        start = max(0, pos - 30)
        end = min(len(sentence), pos + len(phrase) + 30)
        
        # Try to adjust to word boundaries
        if start > 0:
            while start > 0 and sentence[start] != ' ':
                start -= 1
            start += 1  # Move past the space
        
        if end < len(sentence):
            while end < len(sentence) and sentence[end] != ' ':
                end += 1
        
        context = sentence[start:end]
        if start > 0:
            context = "..." + context
        if end < len(sentence):
            context = context + "..."
        
        return context
    
    def _extract_friction_words(self, original_text, translated_text):
        """
        Extract friction words and their replacements by analyzing changes.
        This is maintained for reporting purposes.
        """
        # Process each change to identify friction words
        for change in self.changes:
            change_type = change['type']
            orig = change['original']
            trans = change['translated']
            
            # Extract "should/could/would" type friction words
            if change_type == 'should':
                for pattern in self.should_patterns:
                    matches = re.finditer(pattern, orig, re.IGNORECASE)
                    for match in matches:
                        friction_word = match.group(0)
                        # Try to identify the type of replacement based on the translated text
                        if "might" in trans.lower():
                            context = 'high'
                            replacement = 'might'
                        elif "recommend" in trans.lower():
                            context = 'moderate'
                            replacement = 'recommend'
                        elif "must" in trans.lower():
                            context = 'low'
                            replacement = 'must'
                        elif "want you to" in trans.lower():
                            context = 'low'
                            replacement = 'want you to'
                        elif "surprised by" in trans.lower() and "believe" in orig.lower():
                            context = 'special'
                            replacement = 'was surprised by'
                        else:
                            context = 'general'
                            replacement = '(Azure OpenAI translation)'
                        
                        # Get prompt for this friction word if available
                        prompt_rule = self.prompt_manager.get_prompt_for_word(friction_word, context)
                        
                        # Add to friction words list
                        self.friction_words.append({
                            'type': 'should',
                            'original': friction_word,
                            'replacement': replacement,
                            'prompt': prompt_rule['prompt'] if prompt_rule else None,
                            'example': prompt_rule['example'] if prompt_rule else None
                        })
            
            # Extract "but" type friction words
            elif change_type == 'but':
                for pattern in self.but_patterns:
                    matches = re.finditer(pattern, orig, re.IGNORECASE)
                    for match in matches:
                        friction_word = match.group(0)
                        # Try to identify the type of replacement
                        if "and at the same time" in trans.lower():
                            context = 'contrast'
                            replacement = 'and at the same time'
                        elif "and" in trans.lower() and "but" not in trans.lower() and "yet" not in trans.lower():
                            context = 'clarification'
                            replacement = 'and'
                        elif "except" in trans.lower():
                            context = 'exception'
                            replacement = 'except'
                        else:
                            context = 'general'
                            replacement = '(Azure OpenAI translation)'
                        
                        # Get prompt for this friction word if available
                        prompt_rule = self.prompt_manager.get_prompt_for_word(friction_word, context)
                        
                        # Add to friction words list
                        self.friction_words.append({
                            'type': 'but',
                            'original': friction_word,
                            'replacement': replacement,
                            'prompt': prompt_rule['prompt'] if prompt_rule else None,
                            'example': prompt_rule['example'] if prompt_rule else None
                        })
            
            # Extract "not" type friction words
            elif change_type == 'not':
                for pattern in self.not_patterns:
                    matches = re.finditer(pattern, orig, re.IGNORECASE)
                    for match in matches:
                        friction_word = match.group(0)
                        
                        # Try to identify the context
                        if any(re.search(rf'\b{friction_word}\s+\w*\s*(find|locate)', orig, re.IGNORECASE) for friction_word in ['can\'t', 'cannot', 'couldn\'t']):
                            context = 'ability'
                        elif any(re.search(pattern, orig, re.IGNORECASE) for pattern in [r'\bis\s+not\b', r'\bisn\'t\b', r'\bam\s+not\b']):
                            context = 'state'
                        elif re.search(r'\bno\s+\w+', orig, re.IGNORECASE):
                            context = 'determiner'
                        else:
                            context = 'reframe'
                        
                        # Get prompt for this friction word if available
                        prompt_rule = self.prompt_manager.get_prompt_for_word(friction_word, context)
                        
                        # Add to friction words list
                        self.friction_words.append({
                            'type': 'not',
                            'original': friction_word,
                            'replacement': '(Azure OpenAI translation)',
                            'prompt': prompt_rule['prompt'] if prompt_rule else None,
                            'example': prompt_rule['example'] if prompt_rule else None
                        })
    
    def get_friction_replacements(self):
        """
        Get a summarized list of friction words and their replacements.
        """
        unique_replacements = {}
        for item in self.friction_words:
            key = f"{item['type']}_{item['original']}"
            if key not in unique_replacements:
                unique_replacements[key] = item
        return list(unique_replacements.values())
    
    def get_specific_transformations(self):
        """
        Get the list of specific transformations that were made.
        
        Returns:
            list: Transformation details
        """
        return self.transformations

    def highlight_changes(self, original_text, processed_text):
        """
        Create an HTML-highlighted version of the text showing changes.
        """
        highlighted = processed_text
        for change in self.changes:
            original_segment = change['original']
            translated_segment = change['translated']
            escaped_original = original_segment.replace('<', '&lt;').replace('>', '&gt;')
            escaped_translated = translated_segment.replace('<', '&lt;').replace('>', '&gt;')
            highlight = (
                f'<span class="change" title="{change["explanation"]}">'
                f'<span class="original">{escaped_original}</span> → '
                f'<span class="translated">{escaped_translated}</span></span>'
            )
            highlighted = highlighted.replace(translated_segment, highlight)
        return highlighted
    
    def highlight_changes_inline(self, original_text, processed_text):
        """
        Create an HTML version of the processed text with changes highlighted inline.
        Uses improved word-level diffing for more accurate highlighting.
        
        Args:
            original_text (str): The original text
            processed_text (str): The processed text with changes
            
        Returns:
            str: HTML string with highlighted changes
        """
        # If texts are identical, return without highlighting
        if original_text.strip() == processed_text.strip():
            return processed_text
            
        # Split texts into paragraphs
        original_paragraphs = original_text.split('\n')
        processed_paragraphs = processed_text.split('\n')
        
        result = []
        
        # Process each paragraph
        for i, orig_para in enumerate(original_paragraphs):
            if i < len(processed_paragraphs):
                proc_para = processed_paragraphs[i]
                
                # Check if paragraphs are identical
                if orig_para.strip() == proc_para.strip():
                    result.append(proc_para)
                else:
                    # Highlight differences at the word level for better accuracy
                    result.append(self._highlight_paragraph_changes(orig_para, proc_para))
            else:
                # Original paragraph was removed
                pass
                
        # Add any additional paragraphs in processed text
        for i in range(len(original_paragraphs), len(processed_paragraphs)):
            result.append(processed_paragraphs[i])
        
        # Join paragraphs with line breaks
        html_result = result[0] if result else ""
        for part in result[1:]:
            html_result += "<br>\n" + part
            
        return html_result
    
    def _highlight_paragraph_changes(self, original_para, processed_para):
        """
        Highlight differences between paragraphs using word-by-word comparison
        for better accuracy with identical text that may be rearranged.
        
        Args:
            original_para (str): Original paragraph text
            processed_para (str): Processed paragraph text
            
        Returns:
            str: HTML with changes highlighted
        """
        if original_para.strip() == processed_para.strip():
            return processed_para
            
        # Normalize for comparison
        orig_normalized = self._normalize_text(original_para)
        proc_normalized = self._normalize_text(processed_para)
        
        # Get exact matches before diffing
        exact_matches = self._find_exact_matches(orig_normalized, proc_normalized)
        
        # Split into words for more accurate comparison
        orig_words = self._tokenize_text(original_para)
        proc_words = self._tokenize_text(processed_para)
        
        # Create a word-by-word diff
        matcher = difflib.SequenceMatcher(None, orig_words, proc_words)
        result = []
        
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            orig_part = ' '.join(orig_words[i1:i2])
            proc_part = ' '.join(proc_words[j1:j2])
            
            if tag == 'equal':
                # Exact match - no highlighting
                result.append(proc_part)
            elif tag == 'replace':
                # Check if this is an exact match from our preprocessing
                if proc_part.strip() in exact_matches:
                    # This is actually an exact match despite difflib marking it as different
                    result.append(proc_part)
                else:
                    # Truly changed text - yellow highlight
                    result.append(f'<span class="highlight-change" title="Original: {orig_part}">{proc_part}</span>')
            elif tag == 'delete':
                # Deleted text - not included in result
                pass
            elif tag == 'insert':
                # Check if this is actually a match somewhere in the original
                if proc_part.strip() in orig_normalized or any(self._is_substring_match(proc_part, m) for m in exact_matches):
                    # This is an exact match from the original text - no highlight
                    result.append(proc_part)
                else:
                    # Truly new text - green highlight
                    result.append(f'<span class="highlight-add">{proc_part}</span>')
        highlighted = ' '.join(result)
        highlighted = re.sub(r'\s+([,.;:?!])', r'\1', highlighted)
        highlighted = re.sub(r',\s+(?=\d)', ',', highlighted)
        return highlighted.strip()
    
    def _normalize_text(self, text):
        """Normalize text for comparison by removing extra spaces and lowercasing"""
        return ' '.join(text.lower().split())
    
    def _tokenize_text(self, text):
        """Split text into meaningful tokens (words with punctuation)"""
        # This regex preserves punctuation as part of words where appropriate
        return re.findall(r'\b[\w\'-]+\b|\S', text)
    
    def _find_exact_matches(self, original, processed):
        """Find exact text chunks that appear in both original and processed text"""
        # Extract sentences or phrases
        orig_phrases = re.split(r'[.!?;:]', original)
        proc_phrases = re.split(r'[.!?;:]', processed)
        
        # Find exact matches
        matches = set()
        for orig in orig_phrases:
            orig = orig.strip()
            if not orig:
                continue
                
            for proc in proc_phrases:
                proc = proc.strip()
                if not proc:
                    continue
                    
                # Check for exact matches or if one contains the other
                if orig == proc or orig in proc or proc in orig:
                    matches.add(proc)
                    
        # Also check for smaller clause-level matches
        orig_clauses = re.split(r'[,]', original)
        proc_clauses = re.split(r'[,]', processed)
        
        for orig in orig_clauses:
            orig = orig.strip()
            if not orig:
                continue
                
            for proc in proc_clauses:
                proc = proc.strip()
                if not proc:
                    continue
                    
                # Check for exact matches or if one contains the other
                if orig == proc or orig in proc or proc in orig:
                    matches.add(proc)
        
        return matches
    
    def _is_substring_match(self, text, potential_match):
        """Check if text is a substring of potential_match allowing for minor differences"""
        text = text.strip().lower()
        potential_match = potential_match.strip().lower()
        
        # Direct substring check
        if text in potential_match:
            return True
            
        # Check if text is a substring with minor differences (like punctuation)
        text_words = set(re.findall(r'\b\w+\b', text))
        match_words = set(re.findall(r'\b\w+\b', potential_match))
        
        # If most words from text are in the potential match, consider it a match
        common_words = text_words.intersection(match_words)
        if len(common_words) >= len(text_words) * 0.8:  # 80% threshold
            return True
            
        return False
        
    def set_prompts(self, word_type, prompt):
        """
        Set custom prompts for a specific translator.
        
        Args:
            word_type (str): Type of word ('should', 'but', or 'not')
            prompt (str): Custom prompt template
        """
        if word_type.lower() == 'should':
            self.should_translator.set_prompt(prompt)
        elif word_type.lower() == 'but':
            self.but_translator.set_prompt(prompt)
        elif word_type.lower() == 'not':
            self.not_translator.set_prompt(prompt)
        else:
            raise ValueError(f"Unknown word type: {word_type}")