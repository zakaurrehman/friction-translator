/**
 * Real-Time Corrections - Provides Grammarly-like functionality
 * for the Friction Language Translator (Coherence checking removed)
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const inputText = document.getElementById('inputText');
  const frictionWordsList = document.getElementById('frictionWordsList');
  const emptyAnalysis = document.getElementById('emptyAnalysis');
  const liveSuggestions = document.getElementById('liveSuggestions');
  const translateBtn = document.getElementById('translateBtn');
  const resultsContainer = document.getElementById('resultsContainer');
  
  // Track friction points in the text
  let frictionPoints = [];
  
  // Set up debounced text analysis
  let analysisTimeout;
  const ANALYSIS_DELAY = 2000; // ms
  
  // Initialize
  if (inputText) {
    // Listen for text changes
    inputText.addEventListener('input', function() {
      clearTimeout(analysisTimeout);
      
      const text = this.innerText.trim();
      
      // Only analyze if we have at least 3 words
      if (text.split(/\s+/).length < 3) {
        return;
      }
      
      // Show loading indicator in the panel
      if (frictionWordsList) {
        frictionWordsList.innerHTML = '<div class="analysis-loading"><i class="fas fa-spinner fa-spin"></i> Analyzing text...</div>';
      }
      
      // Hide empty state, show suggestions
      if (emptyAnalysis) emptyAnalysis.style.display = 'none';
      if (liveSuggestions) liveSuggestions.style.display = 'block';
      
      // Debounce the analysis to avoid excessive API calls
      analysisTimeout = setTimeout(function() {
        analyzeTextForFriction();
      }, ANALYSIS_DELAY);
    });
  }
  
  // Hide the translate button since we're now working in real-time
  // if (translateBtn) {
  //   translateBtn.style.display = 'none';
  // }
  
  // Hide results container since we're now working directly in the editor
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
  
  /**
   * Analyze text for friction language
   */
  


 // 0) Helper at the top of the file (above analyzeTextForFriction):
function findIndexInText(haystack, needle) {
  // try straight apostrophes first
  let idx = haystack.indexOf(needle);
  if (idx < 0 && needle.includes("'")) {
    // replace straight → curly and try again
    const curly = needle.replace(/'/g, '’');
    idx = haystack.indexOf(curly);
    needle = curly;
  }
  return { idx, needle };
}

let analyzeTimeout = null;

function analyzeTextForFriction() {
  // 1) Normalize curly quotes to straight for matching
  const rawText = inputText.innerText.trim();
  const text = rawText
    .normalize('NFC')                 // unicode normalization
    .replace(/[\u2018\u2019]/g, "'")   // curly single → straight single
    .replace(/[\u201C\u201D]/g, '"');  // curly double → straight double (optional)

  // 2) Empty-state
  if (!text) {
    if (frictionWordsList) frictionWordsList.innerHTML = '';
    if (emptyAnalysis)    emptyAnalysis.style.display    = 'flex';
    if (liveSuggestions)  liveSuggestions.style.display  = 'none';
    return;
  }

  // 3) Show loading spinner
  if (frictionWordsList) {
    frictionWordsList.innerHTML = `
      <div class="analysis-loading">
        <i class="fas fa-spinner fa-spin"></i> Analyzing text...
      </div>`;
  }
  emptyAnalysis?.style.setProperty('display','none');
  liveSuggestions?.style.setProperty('display','block');

  // 4) Debounce & call /translate
  clearTimeout(analyzeTimeout);
  analyzeTimeout = setTimeout(() => {
    fetch('/translate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text, highlight: true })
    })
    .then(res => {
      if (!res.ok) throw new Error(res.statusText);
      return res.json();
    })
    .then(data => {
      frictionWordsList.innerHTML = '';
      const points = [];
      // ✅ Always prefer transformations
      // if (Array.isArray(data.transformations)) {
      //   data.transformations.forEach((tx, j) => {
      //     const { idx, needle } = findIndexInText(text, tx.original);
      //     if (idx < 0) return;
      //     points.push({
      //       id:         `tx-${j}`,
      //       type:       tx.type,
      //       start_pos:  idx,
      //       end_pos:    idx + needle.length,
      //       original:   needle,
      //       replacement: tx.replacement,
      //       suggestion:  `Replace "${needle}" → "${tx.replacement}".`
      //     });
      //   });
      // }
      // A) friction_words loop
      // if (Array.isArray(data.friction_words)) {
      //   data.friction_words.forEach((fw, i) => {
      //     const { idx, needle } = findIndexInText(text, fw.original);
      //     if (idx < 0) return;
      //     points.push({
      //       id:         `fw-${i}`,
      //       type:       fw.type,
      //       start_pos:  idx,
      //       end_pos:    idx + needle.length,
      //       original:   needle,
      //       replacement: fw.replacement,
      //       suggestion:  fw.replacement
      //         ? `Consider replacing "${needle}" with "${fw.replacement}".`
      //         : `Consider an alternative for "${needle}".`
      //     });
      //   });
      // }

      // B) transformations loop
      if (Array.isArray(data.transformations)) {
        data.transformations.forEach((tx, j) => {
          // 💡 Instead of using findIndexInText, directly use the backend-provided original and replacement
          points.push({
            id:         `tx-${j}`,
            type:       tx.type,
            start_pos:  null, // You can remove highlighting or use a simple marker if needed
            end_pos:    null,
            original:   tx.original,
            replacement: tx.replacement,
            suggestion:  `Replace "${tx.original}" → "${tx.replacement}".`
          });
        });
      }


      // C) no suggestions?
      if (points.length === 0) {
        frictionWordsList.innerHTML = `
          <div class="no-suggestions"
            style="text-align:center; padding:20px; color:var(--text-tertiary);">
            No suggestions found
          </div>`;
        return;
      }

      // D) dedupe & render
      frictionPoints = points;  // Skip removeOverlappingPoints since you're trusting backend fully
      processFrictionPoints();  // This will now correctly render them
    })
    .catch(err => {
      console.error('Real-time translate error', err);
      frictionWordsList.innerHTML = `
        <div class="error-message"
          style="text-align:center; padding:20px; color:var(--accent-color);">
          Error analyzing text. Please try again.
        </div>`;
    });
  }, 500);
}

  
  /**
   * Process friction points (mark in text and display suggestions)
   */
  function processFrictionPoints() {
    // Mark friction points in the text
    markFrictionPointsInText();
    
    // Show suggestions in the panel
    displaySuggestions();
    
    // Update suggestion count
    updateSuggestionCount();
  }
  
  /**
   * Convert transformations format to friction points format
   * This handles the differences in API response formats
   */
  function convertTransformationsToFrictionPoints(transformations, fullText) {
    const points = [];
    
    transformations.forEach((transform, index) => {
      // Check for required properties
      if (!transform.original || !transform.replacement) return;
      
      // Find the position of the original text
      const startPos = fullText.indexOf(transform.original);
      if (startPos === -1) return; // Skip if not found
      
      const point = {
        id: index,
        type: transform.type || 'unknown',
        start_pos: startPos,
        end_pos: startPos + transform.original.length,
        original: transform.original,
        replacement: transform.replacement,
        suggestion: `Consider replacing "${transform.original}" with "${transform.replacement}"`
      };
      
      points.push(point);
    });
    
    return points;
  }
  
  /**
   * Remove overlapping friction points to prevent multiple underlines
   * Prioritizes longer matches over shorter ones
   */
  function removeOverlappingPoints(points) {
    if (!points || points.length <= 1) return points;
    
    // First ensure all points have required properties
    const validPoints = points.filter(p => 
      p && typeof p.start_pos === 'number' && 
      typeof p.end_pos === 'number' && 
      p.original && p.replacement);
    
    // Sort by length (descending) then by start position (ascending)
    // This prioritizes longer matches first
    const sorted = [...validPoints].sort((a, b) => {
      const lengthA = a.end_pos - a.start_pos;
      const lengthB = b.end_pos - b.start_pos;
      
      if (lengthA !== lengthB) {
        return lengthB - lengthA; // Longer matches first
      }
      
      return a.start_pos - b.start_pos; // Then sort by start position
    });
    
    // Track which positions have been covered
    const covered = new Set();
    const result = [];
    
    // Process each friction point
    sorted.forEach((point, index) => {
      // Check for complete overlap
      let isCompletelyOverlapped = false;
      
      // Create unique identifiers for each position in the range
      let positions = [];
      for (let pos = point.start_pos; pos < point.end_pos; pos++) {
        positions.push(pos);
      }
      
      // Check if ALL positions in this range are already covered
      isCompletelyOverlapped = positions.every(pos => covered.has(pos));
      
      if (!isCompletelyOverlapped) {
        // Add to result with a unique ID
        result.push({
          ...point,
          id: index // Ensure each point has a unique ID
        });
        
        // Mark positions as covered
        positions.forEach(pos => covered.add(pos));
      }
    });
    
    // Re-sort by start position for display
    return result.sort((a, b) => a.start_pos - b.start_pos);
  }
  
  /**
   * Mark friction points directly in the text editor
   * Completely rewritten to properly handle HTML and avoid text corruption
   */
  function markFrictionPointsInText() {
    if (!inputText || !frictionPoints.length) return;
    
    // Get current text directly - we'll work with the plain text content
    const originalText = inputText.innerText || '';
    
    // Create document fragment for building the new content
    const tempDiv = document.createElement('div');
    
    // Track current position in the text
    let lastIndex = 0;
    
    // Sort friction points by start position to process them in order
    const sortedPoints = [...frictionPoints].sort((a, b) => a.start_pos - b.start_pos);
    
    // Process each friction point
    sortedPoints.forEach((point) => {
      // Make sure positions are valid
      if (point.start_pos < 0 || point.end_pos > originalText.length || 
          point.start_pos >= point.end_pos) {
        return; // Skip invalid points
      }
      
      // Add text before this friction point
      if (point.start_pos > lastIndex) {
        const textBefore = document.createTextNode(
          originalText.substring(lastIndex, point.start_pos)
        );
        tempDiv.appendChild(textBefore);
      }
      
      // Create a span for the friction point
      const frictionSpan = document.createElement('span');
      frictionSpan.className = `friction-mark friction-type-${point.type || 'unknown'}`;
      frictionSpan.dataset.frictionId = point.id;
      frictionSpan.dataset.original = point.original || '';
      frictionSpan.dataset.replacement = point.replacement || '';
      
      // Set the text content of the span (not HTML)
      frictionSpan.textContent = originalText.substring(point.start_pos, point.end_pos);
      
      // Add the span to our temporary div
      tempDiv.appendChild(frictionSpan);
      
      // Update the last index
      lastIndex = point.end_pos;
    });
    
    // Add any remaining text
    if (lastIndex < originalText.length) {
      const textAfter = document.createTextNode(
        originalText.substring(lastIndex)
      );
      tempDiv.appendChild(textAfter);
    }
    
    // Preserve line breaks (convert them to <br> elements)
    const finalHTML = tempDiv.innerHTML.replace(/\n/g, '<br>');
    
    // Only update if the content has changed
    if (inputText.innerHTML !== finalHTML) {
      // Set the new HTML content
      inputText.innerHTML = finalHTML;
      
      // Add event listeners to friction marks
      const frictionMarks = inputText.querySelectorAll('.friction-mark');
      frictionMarks.forEach(mark => {
        mark.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const frictionId = parseInt(this.dataset.frictionId);
          if (!isNaN(frictionId)) {
            highlightSuggestion(frictionId);
          }
        });
      });
      
      // Try to restore cursor position at the end
      try {
        inputText.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        
        // Get all text nodes
        const textNodes = [];
        const walker = document.createTreeWalker(inputText, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
          textNodes.push(node);
        }
        
        if (textNodes.length > 0) {
          const lastNode = textNodes[textNodes.length - 1];
          range.setStart(lastNode, lastNode.length);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch (e) {
        console.error('Error restoring cursor position:', e);
      }
    }
  }
  
  /**
   * Display suggestions in the analysis panel
   */
  function displaySuggestions() {
    if (!frictionWordsList || !frictionPoints.length) return;
    
    // Add header if needed
    if (frictionPoints.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'suggestion-category';
      separator.innerHTML = `
        <h3 class="suggestion-category-title">Friction Language</h3>
        <p class="suggestion-category-description">
          Words and phrases that may create resistance in communication
        </p>
      `;
      frictionWordsList.appendChild(separator);
    }
    
    frictionPoints.forEach((point) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.className = 'suggestion-item';
      suggestionItem.dataset.frictionId = point.id;
      
      // Suggestion text
      const suggestionText = document.createElement('div');
      suggestionText.className = 'suggestion-text';
      
      // Use the suggestion if provided, or create one
      const suggestionContent = point.suggestion || 
        `Consider replacing "${point.original}" with "${point.replacement}"`;
      
      suggestionText.innerHTML = `<strong>Suggestion:</strong> ${escapeHtml(suggestionContent)}`;
      
      // Correction text
      const correctionText = document.createElement('div');
      correctionText.className = 'suggestion-text';
      correctionText.innerHTML = `<strong>Correction:</strong> "${escapeHtml(point.original)}" → "${escapeHtml(point.replacement)}"`;
      
      // Create action buttons
      const actionButtons = document.createElement('div');
      actionButtons.className = 'suggestion-actions';
      
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
      
      // Options button
      const optionsBtn = document.createElement('button');
      optionsBtn.className = 'suggestion-action suggestion-action-options';
      optionsBtn.textContent = 'Options';
      optionsBtn.addEventListener('click', () => showOptions(point.id));
      
      // Add buttons to container
      actionButtons.appendChild(acceptBtn);
      actionButtons.appendChild(ignoreBtn);
      actionButtons.appendChild(optionsBtn);
      
      // Options container (hidden by default)
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'options-container';
      optionsContainer.style.display = 'none';
      optionsContainer.innerHTML = `<div class="options-loading"><i class="fas fa-spinner fa-spin"></i> Loading options...</div>`;
      
      // Add everything to suggestion item
      suggestionItem.appendChild(suggestionText);
      suggestionItem.appendChild(correctionText);
      suggestionItem.appendChild(actionButtons);
      suggestionItem.appendChild(optionsContainer);
      
      // Add to suggestions list
      frictionWordsList.appendChild(suggestionItem);
    });
  }
  
  /**
   * Accept a suggestion and update the text
   */
  function acceptSuggestion(id) {
    const point = frictionPoints.find(p => p.id === id);
    if (!point) return;
    
    // Get the current text
    const text = inputText.innerText;
    
    // Replace the friction point with its correction
    const newText = 
      text.substring(0, point.start_pos) +
      point.replacement +
      text.substring(point.end_pos);
    
    // Update the editor content
    inputText.innerText = newText;
    
    // Remove the suggestion from the panel
    removeSuggestion(id);
    
    // Re-analyze the text to find any remaining friction points
    analyzeTextForFriction();
  }
  
  /**
   * Ignore a suggestion
   */
  function ignoreSuggestion(id) {
    // Remove the friction point from our tracking
    frictionPoints = frictionPoints.filter(p => p.id !== id);
    
    // Remove the suggestion from the panel
    removeSuggestion(id);
    
    // Re-mark the text with remaining friction points
    markFrictionPointsInText();
    
    // Update suggestion count
    updateSuggestionCount();
  }
  
  /**
   * Remove a suggestion from the panel
   */
  function removeSuggestion(id) {
    const suggestionItem = frictionWordsList.querySelector(`[data-friction-id="${id}"]`);
    if (suggestionItem) {
      // Add fade-out animation
      suggestionItem.classList.add('suggestion-item-removed');
      
      // Remove after animation completes
      setTimeout(() => {
        if (suggestionItem.parentNode) {
          suggestionItem.parentNode.removeChild(suggestionItem);
        }
        
        // Remove category header if no more friction points
        if (frictionPoints.length === 0) {
          const categoryHeader = frictionWordsList.querySelector('.suggestion-category');
          if (categoryHeader) {
            categoryHeader.remove();
          }
        }
        
        // If no suggestions left at all, show empty message
        if (frictionWordsList.children.length === 0) {
          frictionWordsList.innerHTML = `
            <div class="no-suggestions" style="text-align:center; padding:20px; color:var(--text-tertiary);">
              No suggestions found
            </div>
          `;
        }
      }, 300);
    }
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
    
    // Toggle options container
    if (optionsContainer.style.display === 'block') {
      optionsContainer.style.display = 'none';
      return;
    }
    
    // Show options container with loading indicator
    optionsContainer.style.display = 'block';
    
    // Request alternative suggestions from the API
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
        optionsContainer.innerHTML = `<div class="no-options">No alternative suggestions available</div>`;
        return;
      }
      
      // Display alternative options
      let optionsHTML = '<div class="options-list">';
      
      data.alternatives.forEach((alt, altIndex) => {
        optionsHTML += `
          <div class="option-item">
            <div class="option-text">${escapeHtml(alt)}</div>
            <button class="option-accept-btn" data-alt-index="${altIndex}">Use this</button>
          </div>
        `;
      });
      
      optionsHTML += '</div>';
      optionsContainer.innerHTML = optionsHTML;
      
      // Add event listeners to "Use this" buttons
      optionsContainer.querySelectorAll('.option-accept-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const altIndex = parseInt(this.dataset.altIndex);
          const alternative = data.alternatives[altIndex];
          
          // Update the friction point with the selected alternative
          point.replacement = alternative;
          
          // Accept the suggestion with the new replacement
          acceptSuggestion(id);
        });
      });
    })
    .catch(error => {
      console.error('Error fetching alternatives:', error);
      optionsContainer.innerHTML = `
        <div class="error-message">
          Error loading alternatives. Please try again.
        </div>
      `;
    });
  }
  
  /**
   * Highlight a suggestion in the panel
   */
  function highlightSuggestion(id) {
    // First remove highlight from all suggestions
    const allSuggestions = frictionWordsList.querySelectorAll('.suggestion-item');
    allSuggestions.forEach(item => {
      item.classList.remove('suggestion-item-active');
    });
    
    // Then highlight the clicked one
    const suggestionItem = frictionWordsList.querySelector(`[data-friction-id="${id}"]`);
    if (suggestionItem) {
      suggestionItem.classList.add('suggestion-item-active');
      
      // Scroll it into view if needed
      suggestionItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  
  /**
   * Update the suggestion count in the UI
   */
  function updateSuggestionCount() {
    const suggestionCount = document.getElementById('suggestionCount');
    if (suggestionCount) {
      // Count friction points
      const totalCount = frictionPoints.length;
      suggestionCount.textContent = totalCount;
    }
  }
  
  /**
   * Helper function to escape HTML
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
  
  // Add debug feature to show friction points in console when needed
  window.debugFrictionPoints = () => {
    console.table(frictionPoints);
    return `Found ${frictionPoints.length} friction points`;
  };
  
  // Add global function to analyze text
  window.analyzeTextForFriction = function() {
    if (typeof analyzeTextForFriction === 'function') {
      analyzeTextForFriction();
      return true;
    }
    return false;
  };
  
  // Start analysis on page load if there's text
  if (inputText && inputText.innerText.trim()) {
    // Small delay to ensure the UI is ready
    setTimeout(analyzeTextForFriction, 500);
  }
});