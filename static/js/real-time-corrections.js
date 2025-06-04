/**
 * Complete Real-Time Corrections - Enhanced Version with Context-Aware Replacement
 * Addresses all issues: partial word selection, context awareness, spelling errors
 * Works with sentence-level processing for better accuracy
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const inputText = document.getElementById('inputText');
  const frictionWordsList = document.getElementById('frictionWordsList');
  const emptyAnalysis = document.getElementById('emptyAnalysis');
  const liveSuggestions = document.getElementById('liveSuggestions');
  const translateBtn = document.getElementById('translateBtn');
  const resultsContainer = document.getElementById('resultsContainer');
  
  // Track friction points and processed sentences
  let frictionPoints = [];
  let processedSentences = new Map(); // sentence -> processed version
  let isProcessing = false;
  
  // Set up debounced text analysis
  let analysisTimeout;
  const ANALYSIS_DELAY = 1500; // Slightly longer delay for better UX
  
  // Initialize
  if (inputText) {
    // Listen for text changes
    inputText.addEventListener('input', function(e) {
      // Skip if this is a programmatic change
      if (isProcessing) return;
      
      clearTimeout(analysisTimeout);
      
      const text = this.innerText.trim();
      
      // Clear analysis if text is too short
      if (text.split(/\s+/).length < 3) {
        clearAnalysisPanel();
        return;
      }
      
      // Show loading state
      showLoadingState();
      
      // Debounce the analysis
      analysisTimeout = setTimeout(() => {
        analyzeTextForFriction();
      }, ANALYSIS_DELAY);
    });
  }
  
  // Hide results container since we're working in real-time
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
  
  /**
   * Clear the analysis panel and reset state
   */
  function clearAnalysisPanel() {
    if (frictionWordsList) frictionWordsList.innerHTML = '';
    if (emptyAnalysis) emptyAnalysis.style.display = 'flex';
    if (liveSuggestions) liveSuggestions.style.display = 'none';
    frictionPoints = [];
    processedSentences.clear();
    updateSuggestionCount();
  }
  
  /**
   * Show loading state in the analysis panel
   */
  function showLoadingState() {
    if (emptyAnalysis) emptyAnalysis.style.display = 'none';
    if (liveSuggestions) liveSuggestions.style.display = 'block';
    if (frictionWordsList) {
      frictionWordsList.innerHTML = `
        <div class="analysis-loading">
          <i class="fas fa-spinner fa-spin"></i> Analyzing text...
        </div>`;
    }
  }
  
  /**
   * Main analysis function - processes text sentence by sentence
   */
  async function analyzeTextForFriction() {
    
    // 1) Grab the raw text
    let rawText = inputText.innerText.trim();
    if (!rawText) {
      clearAnalysisPanel();
      return;
    }

    // 2) Normalize curly quotes → straight quotes *before* anything else
    rawText = rawText
      .replace(/'/g, "'")
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/"/g, '"')
      .trim();

    console.log("🔍 Normalized text before analysis:", rawText);

    
    try {
      // Break text into sentences using improved parsing
      const sentences = parseTextIntoSentences(rawText);
      console.log(`📝 Found ${sentences.length} sentences to analyze`);
      
      const allFrictionPoints = [];
      let currentPosition = 0;
      
      // Process each sentence individually
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if (!sentence.trim()) {
          currentPosition += sentence.length;
          continue;
        }
        
        console.log(`🔍 Processing sentence ${i + 1}: "${sentence}"`);
        
        // Find the actual position of this sentence in the raw text
        const sentencePosition = findSentencePosition(rawText, sentence, currentPosition);
        
        if (sentencePosition === -1) {
          console.warn(`⚠️ Could not locate sentence in text: "${sentence}"`);
          currentPosition += sentence.length;
          continue;
        }
        
        // Process this sentence with the backend
        const sentenceFrictions = await processSentenceForFriction(sentence, sentencePosition);
        allFrictionPoints.push(...sentenceFrictions);
        
        currentPosition = sentencePosition + sentence.length;
      }
      
      // Update global state
      frictionPoints = allFrictionPoints.sort((a, b) => a.start_pos - b.start_pos);
      
      console.log(`✅ Analysis complete. Found ${frictionPoints.length} friction points`);
      
      // Display results
      if (frictionPoints.length === 0) {
        showNoSuggestions();
      } else {
        markFrictionPointsInText();
        displaySuggestions();
        updateSuggestionCount();
      }
      
    } catch (error) {
      console.error('❌ Error during friction analysis:', error);
      showErrorMessage(error.message);
    }
  }
  
  /**
   * Parse text into sentences with better handling
   */
  function parseTextIntoSentences(text) {
    // Handle multiple sentence endings and preserve structure
    const sentences = [];
    
    // First split by major sentence boundaries
    const majorParts = text.split(/([.!?]+\s*)/);
    
    let currentSentence = '';
    
    for (let i = 0; i < majorParts.length; i++) {
      const part = majorParts[i];
      
      if (/[.!?]+\s*/.test(part)) {
        // This is punctuation - add to current sentence and finish it
        currentSentence += part;
        if (currentSentence.trim()) {
          sentences.push(currentSentence);
        }
        currentSentence = '';
      } else {
        // This is text content
        currentSentence += part;
      }
    }
    
    // Add any remaining content
    if (currentSentence.trim()) {
      sentences.push(currentSentence);
    }
    
    return sentences.filter(s => s.trim().length > 0);
  }
  
  /**
   * Find the exact position of a sentence in the full text
   */
  function findSentencePosition(fullText, sentence, startFrom = 0) {
    // Try exact match first
    let position = fullText.indexOf(sentence, startFrom);
    
    if (position !== -1) {
      return position;
    }
    
    // Try with normalized whitespace
    const normalizedSentence = sentence.replace(/\s+/g, ' ').trim();
    const normalizedFull = fullText.replace(/\s+/g, ' ');
    
    position = normalizedFull.indexOf(normalizedSentence, startFrom);
    
    if (position !== -1) {
      // Convert back to original position
      return convertNormalizedPosition(fullText, position);
    }
    
    return -1;
  }
  
  /**
   * Convert position in normalized text back to original text position
   */
  function convertNormalizedPosition(originalText, normalizedPosition) {
    let originalPos = 0;
    let normalizedPos = 0;
    
    while (originalPos < originalText.length && normalizedPos < normalizedPosition) {
      if (/\s/.test(originalText[originalPos])) {
        // Skip multiple whitespace in original
        while (originalPos < originalText.length && /\s/.test(originalText[originalPos])) {
          originalPos++;
        }
        normalizedPos++; // Count as one space in normalized
      } else {
        originalPos++;
        normalizedPos++;
      }
    }
    
    return originalPos;
  }
  
  /**
   * Process a single sentence for friction language
   */
  async function processSentenceForFriction(sentence, sentencePosition) {
    try {
      console.log(`🔄 Processing sentence at position ${sentencePosition}: "${sentence}"`);
      
      const response = await fetch('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: sentence.trim(), 
          highlight: false 
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`📊 API response for sentence:`, data);
      
      // Store the processed version of this sentence
      if (data.translated && data.translated !== sentence.trim()) {
        processedSentences.set(sentence.trim(), data.translated);
        console.log(`💾 Stored translation: "${sentence.trim()}" → "${data.translated}"`);
      }
      
      // Convert transformations to friction points
      const frictionPoints = [];
      
      if (data.transformations && Array.isArray(data.transformations)) {
        data.transformations.forEach((transform, index) => {
          const frictionPoint = createFrictionPoint(
            transform, 
            sentence, 
            sentencePosition, 
            `${sentencePosition}-${index}`,
            data.translated
          );
          
          if (frictionPoint) {
            frictionPoints.push(frictionPoint);
            console.log(`🎯 Created friction point: "${frictionPoint.original}" at ${frictionPoint.start_pos}-${frictionPoint.end_pos}`);
          }
        });
      }
      
      return frictionPoints;
      
    } catch (error) {
      console.error(`❌ Error processing sentence: "${sentence}"`, error);
      return [];
    }
  }
  
  /**
   * Create a friction point from transformation data
   */
  function createFrictionPoint(transform, sentence, sentencePosition, id, translatedSentence) {
    const originalText = transform.original;
    const replacement = transform.replacement;
    
    if (!originalText) {
      console.warn('⚠️ No original text in transformation:', transform);
      return null;
    }
    
    // Find the position of the original text within the sentence
    const positionInSentence = findWordInSentence(sentence, originalText);
    
    if (positionInSentence === -1) {
      console.warn(`⚠️ Could not find "${originalText}" in sentence: "${sentence}"`);
      return null;
    }
    
    const absoluteStartPos = sentencePosition + positionInSentence;
    const absoluteEndPos = absoluteStartPos + originalText.length;
    
    return {
      id: id,
      type: transform.type || 'unknown',
      original: originalText,
      replacement: replacement || '',
      start_pos: absoluteStartPos,
      end_pos: absoluteEndPos,
      sentence: sentence.trim(),
      translated_sentence: translatedSentence || '',
      suggestion: generateSuggestionText(originalText, replacement, transform.type)
    };
  }
  
  /**
   * Find a word or phrase within a sentence, handling apostrophes and spacing
   */
  function findWordInSentence(sentence, target) {
    // Try exact match first
    let position = sentence.indexOf(target);
    
    if (position !== -1) {
      return position;
    }
    
    // Try with normalized apostrophes
    const normalizedSentence = sentence.replace(/['']/g, "'");
    const normalizedTarget = target.replace(/['']/g, "'");
    
    position = normalizedSentence.indexOf(normalizedTarget);
    
    if (position !== -1) {
      return position;
    }
    
    // Try case-insensitive
    position = sentence.toLowerCase().indexOf(target.toLowerCase());
    
    return position;
  }
  
  /**
   * Generate appropriate suggestion text based on friction type
   */
  function generateSuggestionText(original, replacement, type) {
    if (!replacement) {
      return `Consider improving "${original}" to reduce friction language.`;
    }
    
    switch (type) {
      case 'but':
        return `Replace "${original}" with "${replacement}" to give equal weight to both parts of the sentence.`;
      case 'should':
        return `Replace "${original}" with "${replacement}" to reduce the sense of obligation.`;
      case 'not':
        return `Replace "${original}" with "${replacement}" to use more positive language.`;
      default:
        return `Replace "${original}" with "${replacement}" to improve communication clarity.`;
    }
  }
  
  /**
   * Mark friction points in the text editor
   */
  function markFrictionPointsInText() {
    if (!inputText || frictionPoints.length === 0) {
      return;
    }
    
    console.log(`🎨 Marking ${frictionPoints.length} friction points in text`);
    
    isProcessing = true; // Prevent triggering input events
    
    try {
      const fullText = inputText.innerText;
      const container = document.createElement('div');
      
      // Remove overlapping points
      const nonOverlappingPoints = removeOverlappingPoints(frictionPoints);
      console.log(`✂️ Removed overlaps: ${frictionPoints.length} → ${nonOverlappingPoints.length} points`);
      
      let cursor = 0;
      
      nonOverlappingPoints.forEach(point => {
        // Add text before this friction point
        if (point.start_pos > cursor) {
          const beforeText = fullText.substring(cursor, point.start_pos);
          container.appendChild(document.createTextNode(beforeText));
        }
        
        // Create friction mark span
        const frictionSpan = document.createElement('span');
        frictionSpan.className = `friction-mark friction-type-${point.type}`;
        frictionSpan.dataset.frictionId = point.id;
        frictionSpan.dataset.original = point.original;
        frictionSpan.dataset.replacement = point.replacement;
        frictionSpan.title = point.suggestion;
        
        // Get the actual text from the document to ensure accuracy
        const actualText = fullText.substring(point.start_pos, point.end_pos);
        frictionSpan.textContent = actualText;
        
        // Add click handler
        frictionSpan.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          highlightSuggestion(point.id);
        });
        
        container.appendChild(frictionSpan);
        cursor = point.end_pos;
      });
      
      // Add remaining text
      if (cursor < fullText.length) {
        const remainingText = fullText.substring(cursor);
        container.appendChild(document.createTextNode(remainingText));
      }
      
      // Update editor content
      inputText.innerHTML = container.innerHTML.replace(/\n/g, '<br>');
      
      console.log(`✅ Successfully marked friction points in text`);
      
    } finally {
      isProcessing = false;
    }
  }
  
  /**
   * Remove overlapping friction points, keeping the first one found
   */
  function removeOverlappingPoints(points) {
    const sortedPoints = [...points].sort((a, b) => a.start_pos - b.start_pos);
    const nonOverlapping = [];
    let lastEndPos = -1;
    
    sortedPoints.forEach(point => {
      if (point.start_pos >= lastEndPos) {
        nonOverlapping.push(point);
        lastEndPos = point.end_pos;
      } else {
        console.log(`🚫 Skipping overlapping point: "${point.original}" at ${point.start_pos}-${point.end_pos}`);
      }
    });
    
    return nonOverlapping;
  }
  
  /**
   * Display suggestions in the analysis panel
   */
  function displaySuggestions() {
    if (!frictionWordsList) return;
    
    frictionWordsList.innerHTML = '';
    
    if (frictionPoints.length === 0) {
      showNoSuggestions();
      return;
    }
    
    // Add header
    const header = document.createElement('div');
    header.className = 'suggestion-category';
    header.innerHTML = `
      <h3 class="suggestion-category-title">Friction Language</h3>
      <p class="suggestion-category-description">
        Words and phrases that may create resistance in communication
      </p>
    `;
    frictionWordsList.appendChild(header);
    
    // Group suggestions by sentence to provide context
    const suggestionsBySentence = groupSuggestionsBySentence(frictionPoints);
    
    suggestionsBySentence.forEach(group => {
      group.points.forEach(point => {
        const suggestionItem = createSuggestionItem(point);
        frictionWordsList.appendChild(suggestionItem);
      });
    });
    
    updateSuggestionCount();
  }
  
  /**
   * Group friction points by their originating sentence
   */
  function groupSuggestionsBySentence(points) {
    const groups = new Map();
    
    points.forEach(point => {
      const sentence = point.sentence;
      if (!groups.has(sentence)) {
        groups.set(sentence, {
          sentence: sentence,
          points: []
        });
      }
      groups.get(sentence).points.push(point);
    });
    
    return Array.from(groups.values());
  }
  
  /**
   * Create a suggestion item element
   */
  function createSuggestionItem(point) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.setAttribute('data-friction-id', point.id);
    item.setAttribute('data-category', getCategoryForType(point.type));
    
    // Suggestion text
    const suggestionText = document.createElement('div');
    suggestionText.className = 'suggestion-text';
    suggestionText.innerHTML = `<strong>Suggestion:</strong> ${escapeHtml(point.suggestion)}`;
    item.appendChild(suggestionText);
    
    // Context (show the sentence)
    const contextText = document.createElement('div');
    contextText.className = 'suggestion-text';
    contextText.innerHTML = `<strong>Context:</strong> "${escapeHtml(point.sentence)}"`;
    item.appendChild(contextText);
    
    // Action buttons
    const actions = document.createElement('div');
    actions.className = 'suggestion-actions';
    
    // Accept button
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'suggestion-action suggestion-action-accept';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', () => acceptSuggestion(point.id));
    
    // Ignore button
    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'suggestion-action';
    ignoreBtn.textContent = 'Ignore';
    ignoreBtn.addEventListener('click', () => ignoreSuggestion(point.id));
    
    // Options button (if there's a replacement available)
    if (point.replacement) {
      const optionsBtn = document.createElement('button');
      optionsBtn.className = 'suggestion-action suggestion-action-options';
      optionsBtn.textContent = 'Options';
      optionsBtn.addEventListener('click', () => showOptions(point.id));
      actions.appendChild(optionsBtn);
    }
    
    actions.appendChild(acceptBtn);
    actions.appendChild(ignoreBtn);
    item.appendChild(actions);
    
    // Options container (hidden by default)
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'options-container';
    optionsContainer.style.display = 'none';
    item.appendChild(optionsContainer);
    
    return item;
  }
  
  /**
   * Accept a suggestion - enhanced version with context-aware replacement
   */
  async function acceptSuggestion(id) {
    console.log(`✅ Accepting suggestion: ${id}`);
    
    const point = frictionPoints.find(p => p.id === id);
    if (!point) {
      console.warn(`⚠️ Could not find friction point: ${id}`);
      return;
    }
    
    isProcessing = true;
    
    try {
      // First, check if this replacement might change the sentence meaning
      const mightChangeMeaning = await checkIfReplacementChangesMeaning(point);
      
      if (mightChangeMeaning) {
        console.log(`🔍 Replacement might change meaning, using context-aware approach`);
        await performContextAwareReplacement(point);
      } else {
        console.log(`✅ Simple replacement, proceeding normally`);
        performSimpleReplacement(point);
      }
      
      // Remove this point from tracking
      frictionPoints = frictionPoints.filter(p => p.id !== id);
      removeSuggestion(id);
      updateSuggestionCount();
      
      console.log(`✅ Successfully accepted suggestion: ${id}`);
    }
    catch (error) {
      console.error(`❌ Error accepting suggestion ${id}:`, error);
    }
    finally {
      isProcessing = false;
    }
  }

  /**
   * Check if a replacement might change the sentence meaning
   */
  async function checkIfReplacementChangesMeaning(point) {
    // Define replacements that typically change meaning
    const meaningChangingPatterns = {
      'not': {
        // These typically change meaning significantly
        patterns: ['not', 'never', 'without', 'no', 'cannot', "can't", "don't", "won't"],
        threshold: 0.8 // High likelihood of meaning change
      },
      'should': {
        // These can change obligation level
        patterns: ['should', 'must', 'need to', 'have to', 'ought to'],
        threshold: 0.6
      },
      'but': {
        // These change relationship between clauses
        patterns: ['but', 'yet', 'however', 'although'],
        threshold: 0.5
      }
    };
    
    // Check if this is a significant semantic change
    const typeConfig = meaningChangingPatterns[point.type];
    if (!typeConfig) return false;
    
    const originalLower = point.original.toLowerCase();
    const isSignificant = typeConfig.patterns.some(pattern => 
      originalLower.includes(pattern)
    );
    
    // Also check if the replacement is very different from original
    const replacementSimilarity = calculateSimilarity(point.original, point.replacement);
    
    return isSignificant || replacementSimilarity < 0.5;
  }

  /**
   * Calculate similarity between two strings (0-1)
   */
  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / parseFloat(longer.length);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  function getEditDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Perform context-aware replacement using backend translation
   */
  async function performContextAwareReplacement(point) {
    try {
      // Get the full translation from backend if we don't have it
      if (!point.translated_sentence || point.translated_sentence === point.sentence) {
        console.log(`📡 Fetching context-aware translation from backend`);
        
        const response = await fetch('/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: point.sentence,
            highlight: false 
          })
        });
        
        if (!response.ok) {
          throw new Error(`Failed to get translation: ${response.statusText}`);
        }
        
        const data = await response.json();
        point.translated_sentence = data.translated;
      }
      
      // Now we have both original and translated sentences
      const originalSentence = point.sentence;
      const translatedSentence = point.translated_sentence;
      
      console.log(`📝 Original: "${originalSentence}"`);
      console.log(`📝 Translated: "${translatedSentence}"`);
      
      // Find the specific part that changed
      const changes = findSpecificChanges(originalSentence, translatedSentence, point);
      
      if (changes && changes.replacementText) {
        // Apply the context-aware replacement
        applyContextAwareChange(point, changes);
      } else {
        // Fallback to sentence replacement if we can't identify specific changes
        console.warn(`⚠️ Could not identify specific changes, using full sentence`);
        replaceSentenceWithTranslation(point);
      }
      
    } catch (error) {
      console.error(`❌ Context-aware replacement failed:`, error);
      // Fallback to simple replacement
      performSimpleReplacement(point);
    }
  }

  /**
   * Find the specific changes between original and translated sentences
   */
  function findSpecificChanges(original, translated, point) {
    // First, try to find the exact position of the friction word
    const frictionStart = original.toLowerCase().indexOf(point.original.toLowerCase());
    
    if (frictionStart === -1) {
      console.warn(`⚠️ Could not find friction word in original sentence`);
      return null;
    }
    
    // Use word-level diff to find what changed
    const originalWords = original.split(/\s+/);
    const translatedWords = translated.split(/\s+/);
    
    // Find which words contain our friction point
    let originalWordIndex = -1;
    let currentPos = 0;
    
    for (let i = 0; i < originalWords.length; i++) {
      const word = originalWords[i];
      if (currentPos <= frictionStart && frictionStart < currentPos + word.length) {
        originalWordIndex = i;
        break;
      }
      currentPos += word.length + 1; // +1 for space
    }
    
    if (originalWordIndex === -1) {
      return null;
    }
    
    // Use sequence matching to find the replacement
    const matcher = new difflib.SequenceMatcher(null, originalWords, translatedWords);
    const opcodes = matcher.get_opcodes();
    
    for (const [tag, i1, i2, j1, j2] of opcodes) {
      if (tag === 'replace' && i1 <= originalWordIndex && originalWordIndex < i2) {
        // Found the replacement
        const originalPhrase = originalWords.slice(i1, i2).join(' ');
        const replacementPhrase = translatedWords.slice(j1, j2).join(' ');
        
        // Calculate positions in the original sentence
        const phraseStart = originalWords.slice(0, i1).join(' ').length;
        const phraseEnd = phraseStart + originalPhrase.length;
        
        return {
          originalText: originalPhrase,
          replacementText: replacementPhrase,
          startPos: phraseStart + (i1 > 0 ? 1 : 0), // Account for space
          endPos: phraseEnd + (i1 > 0 ? 1 : 0)
        };
      }
    }
    
    return null;
  }

  /**
   * Apply the context-aware change to the text
   */
  function applyContextAwareChange(point, changes) {
    console.log(`🔧 Applying context-aware change: "${changes.originalText}" → "${changes.replacementText}"`);
    
    // Find the sentence in the current text
    const currentText = inputText.innerText;
    const sentenceStart = currentText.indexOf(point.sentence);
    
    if (sentenceStart === -1) {
      console.warn(`⚠️ Could not find sentence in current text`);
      performSimpleReplacement(point);
      return;
    }
    
    // Calculate the absolute position of the change
    const absoluteStart = sentenceStart + changes.startPos;
    const absoluteEnd = sentenceStart + changes.endPos;
    
    // Build the new text
    const beforeChange = currentText.substring(0, absoluteStart);
    const afterChange = currentText.substring(absoluteEnd);
    const newText = beforeChange + changes.replacementText + afterChange;
    
    // Update the editor while preserving other markings
    updateEditorWithChange(newText, absoluteStart, changes.replacementText.length);
    
    // Visual feedback - briefly highlight the changed part
    highlightChangedText(absoluteStart, changes.replacementText.length);
  }

  /**
   * Update editor with a specific change while preserving other markings
   */
  function updateEditorWithChange(newText, changeStart, changeLength) {
    isProcessing = true;
    
    try {
      // Store cursor position
      const selection = window.getSelection();
      const cursorPos = selection.rangeCount > 0 ? selection.getRangeAt(0).startOffset : 0;
      
      // Update the text
      inputText.innerText = newText;
      
      // Re-apply friction markings except for the changed area
      const updatedFrictionPoints = frictionPoints.filter(fp => {
        // Skip if this friction point is in the changed area
        return !(fp.start_pos >= changeStart && fp.start_pos < changeStart + changeLength);
      });
      
      // Update positions for friction points after the change
      updatedFrictionPoints.forEach(fp => {
        if (fp.start_pos >= changeStart) {
          const diff = changeLength - (fp.end_pos - fp.start_pos);
          fp.start_pos += diff;
          fp.end_pos += diff;
        }
      });
      
      frictionPoints = updatedFrictionPoints;
      
      // Re-mark the friction points
      if (frictionPoints.length > 0) {
        markFrictionPointsInText();
      }
      
      // Restore cursor position
      try {
        const range = document.createRange();
        const textNode = inputText.firstChild;
        if (textNode) {
         range.setStart(textNode, Math.min(cursorPos, textNode.length));
         range.collapse(true);
         selection.removeAllRanges();
         selection.addRange(range);
       }
     } catch (e) {
       console.log('Could not restore cursor position');
     }
     
   } finally {
     isProcessing = false;
   }
 }

 /**
  * Briefly highlight the changed text for visual feedback
  */
 function highlightChangedText(start, length) {
   const text = inputText.innerText;
   const beforeText = text.substring(0, start);
   const changedText = text.substring(start, start + length);
   const afterText = text.substring(start + length);
   
   // Temporarily add highlight
   inputText.innerHTML = 
     escapeHtml(beforeText) + 
     `<span class="context-change-highlight">${escapeHtml(changedText)}</span>` + 
     escapeHtml(afterText);
   
   // Remove highlight after animation
   setTimeout(() => {
     inputText.innerText = text;
     // Re-mark friction points
     if (frictionPoints.length > 0) {
       markFrictionPointsInText();
     }
   }, 2000);
 }

 /**
  * Perform simple replacement (original behavior)
  */
 function performSimpleReplacement(point) {
   if (point.replacement && point.replacement.trim()) {
     const success = replaceSpecificText(point);
     if (!success) {
       console.warn(`⚠️ Simple replacement failed`);
       removeMarkingOnly(point);
     }
   } else {
     removeMarkingOnly(point);
   }
 }

 /**
  * Replace a single friction‐word span inside the editor.
  * Returns true if the span was found & replaced; false otherwise.
  */
 function replaceSpecificText(point) {
   const span = inputText.querySelector(`.friction-mark[data-friction-id="${point.id}"]`);
   if (!span) {
     console.warn(`⚠️ Could not find friction mark span for: ${point.id} ("${point.original}")`);
     return false;
   }
   
   // Replace the span with a text node
   const textNode = document.createTextNode(point.replacement);
   span.parentNode.replaceChild(textNode, span);
   
   console.log(`🔄 Replaced "${point.original}" with "${point.replacement}"`);
   return true;
 }

 /**
  * Replace entire sentence with translation - fixed version
  */
 function replaceSentenceWithTranslation(point) {
   console.log(`🔄 Replacing entire sentence with translation`);
   
   isProcessing = true;
   
   try {
     // First, remove all friction marks from this sentence only
     const sameSentencePoints = frictionPoints.filter(p => p.sentence === point.sentence);
     sameSentencePoints.forEach(p => {
       const span = inputText.querySelector(`.friction-mark[data-friction-id="${p.id}"]`);
       if (span) {
         // Replace span with its text content
         const textNode = document.createTextNode(span.textContent);
         span.parentNode.replaceChild(textNode, span);
       }
     });
     
     // Now find and replace the sentence
     const currentText = inputText.innerText;
     const sentenceIndex = currentText.indexOf(point.sentence);
     
     if (sentenceIndex === -1) {
       console.warn(`⚠️ Could not find sentence in text: "${point.sentence}"`);
       return;
     }
     
     // Build the new content
     const beforeSentence = currentText.substring(0, sentenceIndex);
     const afterSentence = currentText.substring(sentenceIndex + point.sentence.length);
     const newText = beforeSentence + point.translated_sentence + afterSentence;
     
     // Update the editor content while preserving other friction marks
     const tempDiv = document.createElement('div');
     tempDiv.innerHTML = inputText.innerHTML;
     
     // Update only the sentence portion
     const walker = document.createTreeWalker(
       tempDiv,
       NodeFilter.SHOW_TEXT,
       null,
       false
     );
     
     let node;
     let currentPos = 0;
     let sentenceFound = false;
     
     while (node = walker.nextNode()) {
       const nodeText = node.nodeValue;
       const nodeStart = currentPos;
       const nodeEnd = currentPos + nodeText.length;
       
       // Check if this text node contains our sentence
       if (!sentenceFound && nodeText.includes(point.sentence)) {
         const sentenceStartInNode = nodeText.indexOf(point.sentence);
         const beforeText = nodeText.substring(0, sentenceStartInNode);
         const afterText = nodeText.substring(sentenceStartInNode + point.sentence.length);
         
         node.nodeValue = beforeText + point.translated_sentence + afterText;
         sentenceFound = true;
         break;
       }
       
       currentPos = nodeEnd;
     }
     
     if (sentenceFound) {
       // Update the inputText with the modified content
       inputText.innerHTML = tempDiv.innerHTML;
       
       // Remove friction points for this sentence from tracking
       const removedIds = sameSentencePoints.map(p => p.id);
       frictionPoints = frictionPoints.filter(p => p.sentence !== point.sentence);
       
       // Remove corresponding UI elements
       removedIds.forEach(removedId => {
         const suggestionElement = frictionWordsList.querySelector(`[data-friction-id="${removedId}"]`);
         if (suggestionElement) {
           suggestionElement.remove();
         }
       });
       
       console.log(`✅ Replaced sentence and removed ${removedIds.length} related friction points`);
     } else {
       // Fallback to simple replacement if precise method fails
       console.warn('⚠️ Precise sentence replacement failed, using simple method');
       inputText.innerText = newText;
       
       // Re-mark remaining friction points
       setTimeout(() => {
         markFrictionPointsInText();
       }, 100);
     }
     
   } finally {
     isProcessing = false;
   }
 }
 
 /**
  * Remove only the marking without changing text
  */
 function removeMarkingOnly(point) {
   const span = inputText.querySelector(`.friction-mark[data-friction-id="${point.id}"]`);
   if (span) {
     // Replace the span with a text node containing the same content
     const textNode = document.createTextNode(span.textContent);
     span.parentNode.replaceChild(textNode, span);
     console.log(`🔄 Removed marking for: "${point.original}"`);
   }
 }
 
 /**
  * Ignore a suggestion
  */
 function ignoreSuggestion(id) {
   console.log(`🚫 Ignoring suggestion: ${id}`);
   
   const point = frictionPoints.find(p => p.id === id);
   if (point) {
     // Remove the visual friction mark
     removeMarkingOnly(point);
   }
   
   // Remove from tracking
   frictionPoints = frictionPoints.filter(p => p.id !== id);
   
   // Remove from UI
   removeSuggestion(id);
   
   // Update count
   updateSuggestionCount();
 }
 
 /**
  * Remove suggestion from the panel
  */
 function removeSuggestion(id) {
   const suggestionItem = frictionWordsList.querySelector(`[data-friction-id="${id}"]`);
   if (!suggestionItem) return;
   
   suggestionItem.classList.add('suggestion-item-removed');
   
   setTimeout(() => {
     if (suggestionItem.parentNode) {
       suggestionItem.parentNode.removeChild(suggestionItem);
     }
     
     // Clean up UI if no suggestions remain
     if (frictionPoints.length === 0) {
       showNoSuggestions();
     }
   }, 300);
 }
 
 /**
  * Show alternative options for a suggestion
  */
 function showOptions(id) {
   const point = frictionPoints.find(p => p.id === id);
   if (!point) return;
   
   const suggestionItem = frictionWordsList.querySelector(`[data-friction-id="${id}"]`);
   if (!suggestionItem) return;
   
   const optionsContainer = suggestionItem.querySelector('.options-container');
   if (!optionsContainer) return;
   
   // Toggle display
   if (optionsContainer.style.display === 'block') {
     optionsContainer.style.display = 'none';
     return;
   }
   
   // Show loading
   optionsContainer.style.display = 'block';
   optionsContainer.innerHTML = `
     <div class="options-loading">
       <i class="fas fa-spinner fa-spin"></i> Loading alternatives...
     </div>
   `;
   
   // Fetch alternatives
   fetch('/alternative-suggestions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       type: point.type,
       text: point.original
     })
   })
   .then(response => response.json())
   .then(data => {
     if (!data.alternatives || data.alternatives.length === 0) {
       optionsContainer.innerHTML = '<div class="no-options">No alternatives available</div>';
       return;
     }
     
     // Display alternatives
     let optionsHTML = '<div class="options-list">';
     data.alternatives.forEach((alt, index) => {
       optionsHTML += `
         <div class="option-item">
           <div class="option-text">${escapeHtml(alt)}</div>
           <button class="option-accept-btn" data-alt-index="${index}">Use this</button>
         </div>
       `;
     });
     optionsHTML += '</div>';
     
     optionsContainer.innerHTML = optionsHTML;
     
     // Add event listeners
     optionsContainer.querySelectorAll('.option-accept-btn').forEach(btn => {
       btn.addEventListener('click', function() {
         const altIndex = parseInt(this.dataset.altIndex);
         const alternative = data.alternatives[altIndex];
         applyAlternative(id, alternative);
       });
     });
   })
   .catch(error => {
     console.error('Error fetching alternatives:', error);
     optionsContainer.innerHTML = '<div class="error-message">Error loading alternatives</div>';
   });
 }
 
 /**
  * Apply an alternative suggestion
  */
 function applyAlternative(id, alternative) {
   const point = frictionPoints.find(p => p.id === id);
   if (!point) return;
   
   // Update the point's replacement
   point.replacement = alternative;
   
   // Apply the replacement
   replaceSpecificText(point);
   
   // Remove from tracking and UI
   frictionPoints = frictionPoints.filter(p => p.id !== id);
   removeSuggestion(id);
   updateSuggestionCount();
 }
 
 /**
  * Highlight a suggestion in the panel
  */
 function highlightSuggestion(id) {
   // Remove all existing highlights
   frictionWordsList.querySelectorAll('.suggestion-item').forEach(item => {
     item.classList.remove('suggestion-item-active');
   });
   
   // Add highlight to this suggestion
   const suggestionItem = frictionWordsList.querySelector(`[data-friction-id="${id}"]`);
   if (suggestionItem) {
     suggestionItem.classList.add('suggestion-item-active');
     suggestionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
   }
 }
 
 /**
  * Update suggestion count
  */
 function updateSuggestionCount() {
   const suggestionCount = document.getElementById('suggestionCount');
   if (suggestionCount) {
     suggestionCount.textContent = frictionPoints.length;
   }
 }
 
 /**
  * Show no suggestions message
  */
 function showNoSuggestions() {
   if (frictionWordsList) {
     frictionWordsList.innerHTML = `
       <div class="no-suggestions" style="text-align:center; padding:20px; color:var(--text-tertiary);">
         No friction language detected
       </div>
     `;
   }
 }
 
 /**
  * Show error message
  */
 function showErrorMessage(message) {
   if (frictionWordsList) {
     frictionWordsList.innerHTML = `
       <div class="error-message" style="text-align:center; padding:20px; color:var(--accent-color);">
         Error: ${escapeHtml(message)}
       </div>
     `;
   }
 }
 
 /**
  * Get category for friction type
  */
 function getCategoryForType(type) {
   switch (type.toLowerCase()) {
     case 'but':
     case 'yet':
       return 'clarity';
     case 'should':
     case 'could':
     case 'would':
       return 'clarity';
     case 'not':
     case 'no':
     case 'never':
       return 'engagement';
     default:
       return 'clarity';
   }
 }
 
 /**
  * Escape HTML to prevent XSS
  */
 function escapeHtml(str) {
   if (!str) return '';
   return String(str)
     .replace(/&/g, '&amp;')
     .replace(/</g, '&lt;')
     .replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;')
     .replace(/'/g, '&#039;');
 }

 // Add CSS styles for context-aware highlighting
 const style = document.createElement('style');
 style.textContent = `
   .context-change-highlight {
     background-color: #90EE90;
     animation: highlight-fade 2s ease-out;
     border-radius: 3px;
     padding: 0 2px;
   }
   
   @keyframes highlight-fade {
     0% { background-color: #90EE90; }
     100% { background-color: transparent; }
   }
 `;
 document.head.appendChild(style);

 // Add difflib-like sequence matcher (simplified version)
 if (!window.difflib) {
   window.difflib = {
     SequenceMatcher: function(isjunk, a, b) {
       this.a = a;
       this.b = b;
       
       this.get_opcodes = function() {
         const opcodes = [];
         let i = 0, j = 0;
         
         while (i < this.a.length || j < this.b.length) {
           if (i < this.a.length && j < this.b.length && this.a[i] === this.b[j]) {
             const starti = i, startj = j;
             while (i < this.a.length && j < this.b.length && this.a[i] === this.b[j]) {
               i++; j++;
             }
             opcodes.push(['equal', starti, i, startj, j]);
           } else if (i < this.a.length && j < this.b.length) {
             const starti = i, startj = j;
             while (i < this.a.length && (j >= this.b.length || this.a[i] !== this.b[j])) {
               i++;
             }
             while (j < this.b.length && (i >= this.a.length || this.a[i] !== this.b[j])) {
               j++;
             }
             opcodes.push(['replace', starti, i, startj, j]);
           } else if (i < this.a.length) {
             opcodes.push(['delete', i, this.a.length, j, j]);
             i = this.a.length;
           } else {
             opcodes.push(['insert', i, i, j, this.b.length]);
             j = this.b.length;
           }
         }
         
         return opcodes;
       };
     }
   };
 }
 
 // Global functions for debugging and external access
 window.analyzeTextForFriction = analyzeTextForFriction;
 window.debugFrictionPoints = () => {
   console.table(frictionPoints);
   console.log('Processed sentences:', processedSentences);
   return `Found ${frictionPoints.length} friction points`;
 };
 window.clearFrictionAnalysis = clearAnalysisPanel;
 
 // Auto-analyze if there's existing text
 if (inputText && inputText.innerText.trim()) {
   setTimeout(() => {
     console.log('🚀 Auto-analyzing existing text...');
     analyzeTextForFriction();
   }, 1000);
 }
 
 console.log('✅ Real-time corrections system initialized with context-aware replacement');
});
