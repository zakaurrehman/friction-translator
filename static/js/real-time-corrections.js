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
  const raw = inputText.innerText.trim();
  if (!raw) {
    frictionWordsList.innerHTML = '';
    emptyAnalysis.style.display = 'flex';
    liveSuggestions.style.display = 'none';
    return;
  }

  // show spinner
  emptyAnalysis.style.display = 'none';
  liveSuggestions.style.display = 'block';
  frictionWordsList.innerHTML = `
    <div class="analysis-loading">
      <i class="fas fa-spinner fa-spin"></i> Analyzing text…
    </div>`;

  clearTimeout(analyzeTimeout);
  analyzeTimeout = setTimeout(async () => {
    try {
      const res = await fetch('/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: raw, highlight: false })
      });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();

      // build our local list of points from data.transformations
      // const points = (data.transformations || []).map((tx, i) => {
      //   const { idx, needle } = findIndexInText(raw, tx.original);
      //   if (idx < 0) return null;
      //   return {
      //     id: i,
      //     type: tx.type,
      //     start_pos: idx,
      //     end_pos: idx + needle.length,
      //     original: needle,
      //     replacement: tx.replacement,
      //     suggestion: `Replace "${needle}" → "${tx.replacement}".`
      //   };
      // }).filter(Boolean);
      const points = (data.transformations || []).map((tx, i) => ({
        id:           i,
        type:         tx.type,
        original:     tx.original,
        replacement:  tx.replacement,
        start_pos:    null,   // we’ll locate these by span, not by index
        end_pos:      null,
        suggestion:   `Replace "${tx.original}" → "${tx.replacement}".`
      }));

      if (!points.length) {
        frictionWordsList.innerHTML = `
          <div class="no-suggestions" style="text-align:center; padding:20px; color:var(--text-tertiary);">
            No suggestions found
          </div>`;
        return;
      }

      frictionPoints = points;
      processFrictionPoints();
    }
    catch(err) {
      console.error('Real-time translate error', err);
      frictionWordsList.innerHTML = `
        <div class="error-message" style="text-align:center; padding:20px; color:var(--accent-color);">
          Error analyzing text. Please try again.
        </div>`;
    }
  }, 500);
}


  
  /**
   * Process friction points (mark in text and display suggestions)
   */
  function processFrictionPoints() {
    const spinner = frictionWordsList.querySelector('.analysis-loading');
    if (spinner) spinner.remove();
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

  // 1. Grab the full plain-text
  const fullText = inputText.textContent;

  // 2. Clear the editor
  inputText.innerHTML = '';

  let cursor = 0;

  // 3. Sort points by their original index on the original text
  const sorted = [...frictionPoints].sort((a, b) => {
    const ai = fullText.indexOf(a.original, cursor);
    const bi = fullText.indexOf(b.original, cursor);
    return ai - bi;
  });

  sorted.forEach(pt => {
    const { original, replacement, id, type } = pt;
    const idx = fullText.indexOf(original, cursor);
    if (idx < 0) return;

    // 4. Append any text up to this friction point
    const before = fullText.slice(cursor, idx);
    inputText.appendChild(document.createTextNode(before));

    // 5. Create the highlighted span
    const span = document.createElement('span');
    span.className = `friction-mark friction-type-${type}`;
    span.dataset.frictionId  = id;
    span.dataset.original    = original;
    span.dataset.replacement = replacement;
    span.textContent         = original;
    inputText.appendChild(span);

    cursor = idx + original.length;
  });

  // 6. Append any remaining text after the last point
  if (cursor < fullText.length) {
    inputText.appendChild(
      document.createTextNode(fullText.slice(cursor))
    );
  }

  // 7. Attach click handlers for each span
  inputText.querySelectorAll('.friction-mark').forEach(span => {
    span.addEventListener('click', e => {
      e.stopPropagation();
      highlightSuggestion(+span.dataset.frictionId);
    });
  });
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
//  function acceptSuggestion(id) {
//   const point = frictionPoints.find(p => p.id === id);
//   if (!point) return;

//   // 1) Find the span in the DOM
//   const span = inputText.querySelector(`.friction-mark[data-friction-id="${id}"]`);
//   if (!span) return;

//   // 2) Replace that span with a text node of the replacement
//   const textNode = document.createTextNode(point.replacement);
//   span.replaceWith(textNode);

//   // 3) Remove the point from our array & sidebar
//   frictionPoints = frictionPoints.filter(p => p.id !== id);
//   removeSuggestion(id);

//   // 4) Re-highlight any remaining points (no API call!)
//   markFrictionPointsInText();
//   updateSuggestionCount();
// }
function acceptSuggestion(id) {
  // 1) find exactly the <span> in the editor
  const span = inputText.querySelector(
    `.friction-mark[data-friction-id="${id}"]`
  );
  if (!span) return;  // nothing to replace

  // 2) swap it out for the corrected text
  span.replaceWith(document.createTextNode(
    frictionPoints.find(p=>p.id===id).replacement
  ));

  // 3) remove that one point from the sidebar
  frictionPoints = frictionPoints.filter(p=>p.id!==id);
  removeSuggestion(id);

  // 4) re-highlight any *remaining* spans (no new API call!)
  markFrictionPointsInText();
  updateSuggestionCount();
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