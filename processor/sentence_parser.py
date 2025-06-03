import re
import nltk

class SentenceParser:
    def __init__(self):
        """
        Initialize the SentenceParser with enhanced rules for text chunking.
        """
        # Try to download the sentence tokenizer if not already downloaded
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            try:
                nltk.download('punkt', quiet=True)
            except Exception:
                # If download fails, we'll use regex fallback
                pass
        
        # Common abbreviations to handle
        self.common_abbreviations = [
            'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'etc', 'i.e', 'e.g',
            'a.m', 'p.m', 'fig', 'vs', 'inc', 'ltd', 'co', 'corp', 'dept'
        ]
        
        # Simple regex for basic sentence detection (used as fallback)
        self.simple_sentence_pattern = re.compile(r'([.!?])\s+([A-Z])')
        
        # Short phrase detection - enhanced to catch more patterns
        self.short_phrase_pattern = re.compile(r'\b[A-Z][^.!?]*?\s[^.!?]*?[.!?]')
        
        # Negative statement pattern - specifically target common negative constructions
        self.negative_statement_pattern = re.compile(
            r'(?:^|\.\s+)(?:No|Not|I don\'?t|I can\'?t|I won\'?t|I haven\'?t|I\'?m not|It\'?s not|There\'?s no|There is no)'
            r'[^.!?]*?[.!?]', 
            re.IGNORECASE
        )
    
    def parse(self, text):
        """
        Parse text into sentences for processing.
        Uses NLTK's sentence tokenizer with fallback to regex.
        Enhanced to better handle negative statements and sequential sentences.
        
        Args:
            text (str): Text to parse
            
        Returns:
            list: List of sentences
        """
        if not text or not text.strip():
            return []
        
        # Normalize text
        normalized_text = text.replace("’", "'").replace("‘", "'")
        normalized_text = normalized_text.replace("“", '"').replace("”", '"')

        
        # Store all segments with their positions in original text
        segments_with_positions = []
        
        # Try using NLTK's sentence tokenizer first
        try:
            sentences = nltk.sent_tokenize(normalized_text)
            
            # If NLTK fails to properly tokenize (returns only one item for a long text)
            if len(sentences) <= 1 and len(normalized_text) > 150 and any(p in normalized_text for p in ['.', '!', '?']):
                # Fall back to regex-based approach
                sentences = self._regex_based_parsing(normalized_text)
        except Exception:
            # Fallback to regex-based approach if NLTK fails
            sentences = self._regex_based_parsing(normalized_text)
        
        # Add sentences with their positions to the list
        for sentence in sentences:
            pos = normalized_text.find(sentence)
            if pos >= 0:
                segments_with_positions.append((pos, sentence))
        
        # Enhanced: Look for potential negative constructions that might need special processing
        negative_statements = self._find_negative_statements(normalized_text)
        
        # Add negative statements with their positions
        for statement in negative_statements:
            pos = normalized_text.find(statement)
            if pos >= 0:
                segments_with_positions.append((pos, statement))
        
        # Look for potential short sentences or phrases that might have been missed
        # by both NLTK and regex (especially for texts like "Not what I wanted.")
        potential_additional = self._find_short_phrases(normalized_text, sentences + negative_statements)
        
        # Add potential additional segments with their positions
        for segment in potential_additional:
            pos = normalized_text.find(segment)
            if pos >= 0:
                segments_with_positions.append((pos, segment))
        
        # Remove duplicate or highly similar segments
        deduplicated_segments = []
        seen_positions = set()
        
        # Sort by position first to ensure we process in order
        segments_with_positions.sort(key=lambda x: x[0])
        
        for pos, segment in segments_with_positions:
            # Check if we already have a segment at this position or nearby
            if any(abs(pos - existing_pos) < 5 for existing_pos in seen_positions):
                # Check if this segment is a duplicate or very similar to an existing one
                is_duplicate = False
                for existing_pos, existing_segment in deduplicated_segments:
                    if (self._is_similar(segment, existing_segment) or 
                        self._is_substring(segment, existing_segment) or 
                        self._is_substring(existing_segment, segment)):
                        
                        # If segments overlap and current is longer, replace the existing one
                        if len(segment) > len(existing_segment):
                            deduplicated_segments.remove((existing_pos, existing_segment))
                            deduplicated_segments.append((pos, segment))
                            seen_positions.add(pos)
                        
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    deduplicated_segments.append((pos, segment))
                    seen_positions.add(pos)
            else:
                deduplicated_segments.append((pos, segment))
                seen_positions.add(pos)
        
        # Re-sort by position to ensure correct order
        deduplicated_segments.sort(key=lambda x: x[0])
        
        # Extract just the segments
        filtered_segments = [segment for _, segment in deduplicated_segments]
        
        # If we still have no segments, treat the entire text as one segment
        if not filtered_segments and normalized_text.strip():
            return [normalized_text.strip()]
        
        # New: Check if we have very long segments that might benefit from further splitting
        processed_segments = []
        for segment in filtered_segments:
            if len(segment.split()) > 30 and ('and' in segment or 'but' in segment or ';' in segment):
                # Try to split long compound sentences
                parts = self._split_compound_sentence(segment)
                # Get the position of the segment
                segment_pos = normalized_text.find(segment)
                
                # Calculate estimated positions for the parts
                for i, part in enumerate(parts):
                    # Find the part within the segment to get an offset
                    part_offset = segment.find(part)
                    if part_offset >= 0:
                        # Calculate the absolute position in the original text
                        abs_pos = segment_pos + part_offset
                        processed_segments.append((abs_pos, part))
                    else:
                        # If we can't find it (shouldn't happen), append with estimated position
                        processed_segments.append((segment_pos + i * 10, part))
            else:
                segment_pos = normalized_text.find(segment)
                processed_segments.append((segment_pos, segment))
        
        # Final sort by position to ensure correct order
        processed_segments.sort(key=lambda x: x[0])
        
        # Extract just the segments
        final_segments = [segment for _, segment in processed_segments]
        
        return final_segments
    
    def _is_similar(self, text1, text2):
        """
        Check if two texts are similar using Jaccard similarity.
        
        Args:
            text1 (str): First text
            text2 (str): Second text
            
        Returns:
            bool: True if texts are similar, False otherwise
        """
        # Convert texts to sets of words
        set1 = set(text1.lower().split())
        set2 = set(text2.lower().split())
        
        # Compute Jaccard similarity
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        # Return True if similarity is high
        return (intersection / union if union > 0 else 0) > 0.8
    
    def _is_substring(self, text1, text2):
        """
        Check if text1 is a substring of text2 (allowing for minor differences).
        
        Args:
            text1 (str): Potential substring
            text2 (str): Text to check against
            
        Returns:
            bool: True if text1 is a substring of text2, False otherwise
        """
        # Normalize texts
        text1_norm = text1.lower()
        text2_norm = text2.lower()
        
        # Direct substring check
        if text1_norm in text2_norm:
            return True
        
        # Check if most words from text1 are in text2 in the same order
        words1 = text1_norm.split()
        words2 = text2_norm.split()
        
        # If text1 is much longer than text2, it can't be a substring
        if len(words1) > len(words2) + 5:
            return False
        
        # Count words from text1 that appear in text2
        common_words = sum(1 for word in words1 if word in words2)
        
        # Return True if most words are common
        return common_words >= len(words1) * 0.8
    
    def _regex_based_parsing(self, text):
        """
        Parse text into sentences using regex patterns.
        Used as a fallback when NLTK is not available or fails.
        
        Args:
            text (str): Text to parse
            
        Returns:
            list: List of sentences
        """
        # Handle abbreviations to prevent false splits
        for abbr in self.common_abbreviations:
            text = re.sub(rf'\b{abbr}\.', f"{abbr}__DOT__", text, flags=re.IGNORECASE)
        
        # Split text using a simple regex pattern
        sentences = []
        previous_end = 0
        
        for match in self.simple_sentence_pattern.finditer(text):
            end_pos = match.start() + 1  # Position after the punctuation
            sentences.append(text[previous_end:end_pos].strip())
            previous_end = end_pos
        
        # Add the last sentence
        if previous_end < len(text):
            sentences.append(text[previous_end:].strip())
        
        # Restore abbreviations
        restored_sentences = []
        for sentence in sentences:
            for abbr in self.common_abbreviations:
                sentence = sentence.replace(f"{abbr}__DOT__", f"{abbr}.", 1)
            restored_sentences.append(sentence)
        
        return restored_sentences
    
    def _find_negative_statements(self, text):
        """
        Find negative statements that should be processed as separate units.
        Particularly useful for sentences like "Not what I wanted."
        
        Args:
            text (str): Original text
            
        Returns:
            list: Negative statements found
        """
        negative_statements = []
        
        # Look for patterns like "Not what I wanted." or "No way."
        for match in self.negative_statement_pattern.finditer(text):
            statement = match.group(0).strip()
            # Clean up the beginning if it starts with a period and space
            if statement.startswith('. '):
                statement = statement[2:]
            negative_statements.append(statement)
        
        return negative_statements
    
    def _find_short_phrases(self, text, existing_sentences):
        """
        Find short phrases that might have been missed by the main tokenization.
        Particularly useful for short sentences like "Not what I wanted."
        Enhanced to avoid duplicates with existing sentences.
        
        Args:
            text (str): Original text
            existing_sentences (list): Sentences already identified
            
        Returns:
            list: Additional short phrases found
        """
        additional_phrases = []
        
        # Look for patterns like "X what Y." or "Not what I wanted."
        for match in self.short_phrase_pattern.finditer(text):
            phrase = match.group(0)
            
            # Check if this phrase is a duplicate or subset of existing sentences
            should_add = True
            for existing in existing_sentences:
                # If exact match or subset relationship, don't add
                if (self._is_similar(phrase, existing) or 
                    self._is_substring(phrase, existing) or 
                    self._is_substring(existing, phrase)):
                    should_add = False
                    break
            
            if should_add:
                additional_phrases.append(phrase)
        
        # Look for specific problematic phrases that are commonly seen as friction language
        problematic_phrases = [
            r'Not what I wanted\.', 
            r'I didn\'t get it done\.', 
            r'So, I am not going to be smiling',
            r'These are not things I normally do\.',
            r'I don\'t know how',
            r'I am not there\.',
            r'No, I\'m not\.',
            r'No\.',
            r'Nothing\.'
        ]
        
        for pattern in problematic_phrases:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                phrase = match.group(0)
                
                # Check for duplicates
                should_add = True
                for existing in existing_sentences + additional_phrases:
                    if (self._is_similar(phrase, existing) or 
                        self._is_substring(phrase, existing) or 
                        self._is_substring(existing, phrase)):
                        should_add = False
                        break
                        
                if should_add:
                    additional_phrases.append(phrase)
        
        return additional_phrases
    
    def _split_compound_sentence(self, sentence):
        """
        Split a long compound sentence into smaller parts for better processing.
        Particularly useful for sentences joined with 'and', 'but', or semicolons.
        
        Args:
            sentence (str): Long sentence to split
            
        Returns:
            list: Split sentence parts
        """
        parts = []
        
        # Try splitting by semicolons first
        if ';' in sentence:
            semicolon_parts = sentence.split(';')
            for part in semicolon_parts:
                part = part.strip()
                if part:
                    # Ensure it starts with a capital letter
                    if len(part) > 0:
                        parts.append(part[0].upper() + part[1:] if len(part) > 1 else part.upper())
        else:
            # Try splitting by conjunctions
            conjunction_splits = re.split(r'\s+(?:and|but)\s+', sentence)
            
            if len(conjunction_splits) > 1:
                for i, part in enumerate(conjunction_splits):
                    part = part.strip()
                    if part:
                        # For parts after the first, add the conjunction back
                        if i > 0:
                            # Determine which conjunction was used
                            if i < len(conjunction_splits):
                                preceding_text = sentence[:sentence.find(part)].strip()
                                if preceding_text.endswith('and'):
                                    conjunction = 'And'
                                elif preceding_text.endswith('but'):
                                    conjunction = 'But'
                                else:
                                    conjunction = 'And'  # Default
                                
                                # Add the conjunction
                                part = f"{conjunction} {part}"
                        
                        parts.append(part)
            else:
                # If# If no conjunctions, look for common clause markers
                clause_splits = re.split(r', (?:which|who|when|where|because|although|since)\s+', sentence)
                
                if len(clause_splits) > 1:
                    # Re-join clauses with the markers included
                    current_position = 0
                    for i, part in enumerate(clause_splits):
                        if i == 0:
                            parts.append(part.strip())
                        else:
                            # Look for the next marker
                            start_of_part = sentence.find(part, current_position)
                            if start_of_part > 0:
                                # Get the text between previous part and this one, which should include the marker
                                marker_text = sentence[current_position:start_of_part].strip()
                                # Ensure it's capitalized as a new sentence
                                part_with_marker = marker_text + part
                                parts.append(part_with_marker[0].upper() + part_with_marker[1:] if len(part_with_marker) > 1 else part_with_marker.upper())
                                current_position = start_of_part + len(part)
                else:
                    # If no splitting was possible, return the original
                    parts = [sentence]
        
        # If splitting failed, return the original
        if not parts:
            parts = [sentence]
            
        return parts