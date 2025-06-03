/**
 * Complete Real-Time Corrections - Fixed Version
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
      .replace(/’/g, "'")
      .replace(/‘/g, "'")
      .replace(/“/g, '"')
      .replace(/”/g, '"')
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
   * Accept a suggestion - improved version with fallback
   */
  function acceptSuggestion(id) {
    console.log(`✅ Accepting suggestion: ${id}`);
    
    const point = frictionPoints.find(p => p.id === id);
    if (!point) {
      console.warn(`⚠️ Could not find friction point: ${id}`);
      return;
    }
    
    isProcessing = true;
    
    try {
      if (point.replacement && point.replacement.trim()) {
        // Try replacing just the single word/phrase first
        const success = replaceSpecificText(point);
        if (!success && point.translated_sentence) {
          // Fallback: if the small‐span replace failed, replace entire sentence
          console.warn(`⚠️ Small‐span replace failed for "${point.original}", falling back to sentence replacement.`);
          replaceSentenceWithTranslation(point);
          
          // Also remove any other friction points belonging to the same sentence,
          // so we don't leave stray marks behind.
          const removedIds = frictionPoints
            .filter((p2) => p2.sentence === point.sentence)
            .map((p2) => p2.id);
          frictionPoints = frictionPoints.filter((p2) => p2.sentence !== point.sentence);
          removedIds.forEach((rid) => removeSuggestion(rid));
        }
      }
      else if (point.translated_sentence) {
        // If there is no single-word replacement but there is a whole-sentence translation:
        replaceSentenceWithTranslation(point);
        
        // Remove other friction points from this sentence
        const removedIds = frictionPoints
          .filter((p2) => p2.sentence === point.sentence)
          .map((p2) => p2.id);
        frictionPoints = frictionPoints.filter((p2) => p2.sentence !== point.sentence);
        removedIds.forEach((rid) => removeSuggestion(rid));
      }
      else {
        // If neither a replacement nor a sentence‐translation exists, just clear the highlight
        removeMarkingOnly(point);
      }
      
      // Finally, remove this point itself (if it hasn’t already been removed)
      frictionPoints = frictionPoints.filter((p2) => p2.id !== id);
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
   * Replace a single friction‐word span inside the editor.
   * Returns true if the span was found & replaced; false otherwise.
   */
  function replaceSpecificText(point) {
    const span = inputText.querySelector(`.friction-mark[data-friction-id="${point.id}"]`);
    if (!span) {
      console.warn(`⚠️ Could not find friction mark span for: ${point.id} ("${point.original}")`);
      return false;
    }
    
    // Replace the text content
    span.textContent = point.replacement;
    
    // Remove friction styling
    span.classList.remove('friction-mark', `friction-type-${point.type}`);
    span.removeAttribute('data-friction-id');
    span.removeAttribute('data-original');
    span.removeAttribute('data-replacement');
    span.removeAttribute('title');
    
    console.log(`🔄 Replaced "${point.original}" with "${point.replacement}"`);
    return true;
  }

  
  /**
   * Replace entire sentence with translation
   */
  function replaceSentenceWithTranslation(point) {
    console.log(`🔄 Replacing entire sentence with translation`);
    
    const currentText = inputText.innerText;
    const sentenceIndex = currentText.indexOf(point.sentence);
    
    if (sentenceIndex === -1) {
      console.warn(`⚠️ Could not find sentence in text: "${point.sentence}"`);
      return;
    }
    
    // Calculate new text
    const beforeSentence = currentText.substring(0, sentenceIndex);
    const afterSentence = currentText.substring(sentenceIndex + point.sentence.length);
    const newText = beforeSentence + point.translated_sentence + afterSentence;
    
    // Update editor
    inputText.innerText = newText;
    
    // Remove all friction points from this sentence
    const removedIds = frictionPoints
      .filter(p => p.sentence === point.sentence)
      .map(p => p.id);
    
    frictionPoints = frictionPoints.filter(p => p.sentence !== point.sentence);
    
    // Remove corresponding UI elements
    removedIds.forEach(removedId => {
      const suggestionElement = frictionWordsList.querySelector(`[data-friction-id="${removedId}"]`);
      if (suggestionElement) {
        suggestionElement.remove();
      }
    });
    
    console.log(`🔄 Replaced sentence and removed ${removedIds.length} related friction points`);
  }
  
  /**
   * Just remove the friction marking without changing text
   */
  function removeMarkingOnly(point) {
    const span = inputText.querySelector(`.friction-mark[data-friction-id="${point.id}"]`);
    if (span) {
      // Remove friction styling but keep the text
      span.classList.remove('friction-mark', `friction-type-${point.type}`);
      span.removeAttribute('data-friction-id');
      span.removeAttribute('data-original');
      span.removeAttribute('data-replacement');
      span.removeAttribute('title');
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
  
  console.log('✅ Real-time corrections system initialized');
});