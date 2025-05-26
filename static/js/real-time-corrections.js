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
  let lastRawText = '';
  
  // Set up debounced text analysis
  let analysisTimeout;
  const ANALYSIS_DELAY = 2000; // ms
   
  
  // Initialize
  if (inputText) {
    // Listen for text changes
    inputText.addEventListener('input', function() {
      clearTimeout(analysisTimeout);
      
      const text = this.innerText;
      
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
  
  // Hide results container since we're now working directly in the editor
  if (resultsContainer) {
    resultsContainer.style.display = 'none';
  }
  
  // Helper function to find index in text with apostrophe handling
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

async function analyzeTextForFriction() {
  const raw = inputText.innerText;
  lastRawText = raw;

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
      // 1) break raw text into sentences (or short clauses)
      //    This regex grabs anything ending in . ! or ? including the punctuation.
      // new: split on . ! ? or , (so that each chunk ends with one of those)
     const segments = raw.match(/[^.!?,]+[.!?,]+/g) || [raw];


      const points = [];
      let cursor = 0; // running offset into the full text

      for (let i = 0; i < segments.length; i++) {
        let segment = segments[i].trim();
        if (!segment) {
          cursor += segments[i].length;
          continue;
        }

        // send *only* this segment to your translate endpoint
        const res = await fetch('/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: segment, highlight: true })
        });
        if (!res.ok) throw new Error(res.statusText);

        const {
          transformations = [],
          original: segOriginal = segment,
          translated: segTranslated = ''
        } = await res.json();

        console.log(`Segment ${i} (${segment.length} chars) =>`, transformations);

        // normalize curly apostrophes so both ’ and ' match
        const normSegment = segment.replace(/[’]/g, "'").toLowerCase();

        transformations.forEach((tx, j) => {
          const needle = tx.original?.trim();
          if (!needle) return;

          const normNeedle = needle.replace(/[’]/g, "'").toLowerCase();
          const idx = normSegment.indexOf(normNeedle);
          if (idx === -1) {
            console.warn(`Couldn't find "${needle}" in segment ${i}`);
            return;
          }

          const startPos = cursor + idx;
          const endPos = startPos + needle.length;

          points.push({
            id: `seg${i}-tx${j}`,
            type: tx.type || 'unknown',
            original: segment.slice(idx, idx + needle.length),
            replacement: tx.replacement || '',
            start_pos: startPos,
            end_pos: endPos,
            suggestion: `Replace "${needle}" → "${tx.replacement || '…'}".`,
            original_sentence: segOriginal,
            translated_sentence: segTranslated,
            context: tx.context
          });

          console.log(`  ✔ point seg${i}-tx${j}: "${needle}" @${startPos}-${endPos}`);
        });

        // advance cursor past exactly this segment in the raw text
        // find where this segment actually sits in the raw
        const rawLower = raw.toLowerCase();
        const segLower = segment.toLowerCase();
        const foundAt = rawLower.indexOf(segLower, cursor);
        cursor = foundAt >= 0
          ? foundAt + segment.length
          : cursor + segments[i].length;
      }

      // sort & render
      frictionPoints = points.sort((a, b) => a.start_pos - b.start_pos);
      console.log(`Final friction points: ${frictionPoints.length}`);
      processFrictionPoints();
    }
    catch (err) {
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
    // clear spinner
    const spinner = frictionWordsList.querySelector('.analysis-loading');
    if (spinner) spinner.remove();

    // Mark friction points in text and display suggestions
    markFrictionPointsInText();
    displaySuggestions();
    updateSuggestionCount();
  }

  /**
   * Mark friction points directly in the text editor with proper underlining
   */
/**
 * Mark friction points directly in the text editor with proper underlining
 * Handles overlapping positions by prioritizing longer matches
 */
function markFrictionPointsInText() {
  if (!lastRawText || !frictionPoints.length) {
    // If no friction points, just restore the original text
    inputText.innerHTML = lastRawText.replace(/\n/g, '<br>');
    return;
  }

  const raw = lastRawText;
  let cursor = 0;
  const container = document.createElement('div');

  // Sort friction points by position and handle overlaps
  const sortedPoints = [...frictionPoints].sort((a, b) => a.start_pos - b.start_pos);
  
  // Remove overlapping points (keep the first one at each position)
  const nonOverlappingPoints = [];
  let lastEndPos = -1;
  
  sortedPoints.forEach(point => {
    // Only add if this point doesn't overlap with the previous one
    if (point.start_pos >= lastEndPos) {
      nonOverlappingPoints.push(point);
      lastEndPos = point.end_pos;
      console.log(`✅ Keeping point: "${point.original}" at ${point.start_pos}-${point.end_pos}`);
    } else {
      console.log(`❌ Skipping overlapping point: "${point.original}" at ${point.start_pos}-${point.end_pos}`);
    }
  });

  console.log(`Marking ${nonOverlappingPoints.length} non-overlapping points out of ${frictionPoints.length} total`);

  nonOverlappingPoints.forEach(pt => {
    // Add text before this friction point
    if (pt.start_pos > cursor) {
      container.appendChild(
        document.createTextNode(raw.slice(cursor, pt.start_pos))
      );
    }
    
    // Create the friction span with proper styling
    const span = document.createElement('span');
    span.className = `friction-mark friction-type-${pt.type || 'unknown'}`;
    span.dataset.frictionId = pt.id;
    span.dataset.original = pt.original;
    span.dataset.replacement = pt.replacement;
    span.title = `${pt.original} → ${pt.replacement}`; // Tooltip
    span.textContent = raw.slice(pt.start_pos, pt.end_pos);
    
    // Add click handler
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      highlightSuggestion(pt.id);
    });
    
    container.appendChild(span);
    cursor = pt.end_pos;
  });

  // Add any remaining text
  if (cursor < raw.length) {
    container.appendChild(
      document.createTextNode(raw.slice(cursor))
    );
  }

  // Update the editor content, preserving line breaks
  inputText.innerHTML = container.innerHTML.replace(/\n/g, '<br>');
  
  const markedSpans = inputText.querySelectorAll('.friction-mark');
  console.log(`Marked ${markedSpans.length} friction spans in DOM`);
}
  
  /**
   * Display suggestions in the analysis panel
   */
  function displaySuggestions() {
    if (!frictionWordsList) return;
    frictionWordsList.innerHTML = '';
    
    if (frictionPoints.length === 0) {
      frictionWordsList.innerHTML = `
        <div class="no-suggestions" style="text-align:center; padding:20px; color:var(--text-tertiary);">
          No suggestions found
        </div>`;
      return;
    }

    // Add header
    const separator = document.createElement('div');
    separator.className = 'suggestion-category';
    separator.innerHTML = `
      <h3 class="suggestion-category-title">Friction Language</h3>
      <p class="suggestion-category-description">
        Words and phrases that may create resistance in communication
      </p>`;
    frictionWordsList.appendChild(separator);

    // Add each suggestion
    frictionPoints.forEach(point => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.dataset.frictionId = point.id;

      // Suggestion text
      const suggestionText = document.createElement('div');
      suggestionText.className = 'suggestion-text';
      suggestionText.innerHTML = `
        <strong>Suggestion:</strong>
        Replace "${escapeHtml(point.original)}" → "${escapeHtml(point.replacement || 'positive alternative')}"
      `;
      item.appendChild(suggestionText);

      // Correction text
      const correctionText = document.createElement('div');
      correctionText.className = 'suggestion-text';
      correctionText.innerHTML = `
        <strong>Correction:</strong> 
        "${escapeHtml(point.original)}" → "${escapeHtml(point.replacement || point.translated_sentence)}"
      `;
      item.appendChild(correctionText);

      // Action buttons
      const actions = document.createElement('div');
      actions.className = 'suggestion-actions';
      
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'suggestion-action suggestion-action-accept';
      acceptBtn.textContent = 'Accept';
      acceptBtn.addEventListener('click', () => acceptSuggestion(point.id));
      
      const ignoreBtn = document.createElement('button');
      ignoreBtn.className = 'suggestion-action';
      ignoreBtn.textContent = 'Ignore';
      ignoreBtn.addEventListener('click', () => ignoreSuggestion(point.id));
      
      const optionsBtn = document.createElement('button');
      optionsBtn.className = 'suggestion-action suggestion-action-options';
      optionsBtn.textContent = 'Options';
      optionsBtn.addEventListener('click', () => showOptions(point.id));
      
      actions.append(acceptBtn, ignoreBtn, optionsBtn);
      item.appendChild(actions);

      // Hidden alternatives container
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'options-container';
      optionsContainer.style.display = 'none';
      item.appendChild(optionsContainer);

      frictionWordsList.appendChild(item);
    });

    updateSuggestionCount();
  }
  
  /**
   * Accept a suggestion and update the text
   */
function acceptSuggestion(id) {
  // Find the friction point
  const point = frictionPoints.find(p => p.id === id);
  if (!point) return;

  // Check if replacement is empty or just whitespace
  const hasValidReplacement = point.replacement && point.replacement.trim() !== '';
  
  if (!hasValidReplacement && point.translated_sentence) {
    // Case 1: Empty replacement - replace entire sentence with translated version
    console.log(`Empty replacement for "${point.original}", using translated sentence`);
    console.log(`Original sentence: "${point.original_sentence}"`);
    console.log(`Translated sentence: "${point.translated_sentence}"`);
    
    // Replace the entire sentence in the editor (this will preserve other friction marks)
    replaceSentenceInEditor(point.original_sentence, point.translated_sentence);
    
    // Remove all friction points that belonged to this sentence since it's been replaced
    const removedPoints = frictionPoints.filter(p => 
      p.original_sentence === point.original_sentence
    );
    
    console.log(`Removing ${removedPoints.length} friction points from replaced sentence:`, removedPoints.map(p => p.original));
    
    frictionPoints = frictionPoints.filter(p => 
      p.original_sentence !== point.original_sentence
    );
    
    // Remove suggestion cards for this sentence - use a more targeted approach
    removedPoints.forEach(removedPoint => {
      const card = document.querySelector(`[data-friction-id="${removedPoint.id}"]`);
      if (card) {
        console.log(`Removing suggestion card for "${removedPoint.original}"`);
        card.remove();
      }
    });
    
    // Update suggestion count
    updateSuggestionCount();
    
    // Don't run the normal cleanup since we handled it above
    return;
    
  } else if (hasValidReplacement) {
    // Case 2: Valid replacement - replace just the friction word/phrase
    console.log(`Valid replacement: "${point.original}" → "${point.replacement}"`);
    
    const span = inputText.querySelector(`.friction-mark[data-friction-id="${id}"]`);
    if (span) {
      // Get the original text content to preserve spacing
      const originalText = span.textContent;
      const replacement = point.replacement;
      
      // Check for spacing issues - if original has spaces, preserve them
      let finalReplacement = replacement;
      
      // If the original text had leading/trailing spaces, preserve them
      if (originalText.startsWith(' ')) {
        finalReplacement = ' ' + finalReplacement;
      }
      if (originalText.endsWith(' ')) {
        finalReplacement = finalReplacement + ' ';
      }
      
      // Replace the span content with the replacement text
      span.textContent = finalReplacement;
      
      // Remove friction styling but keep the span
      span.classList.remove('friction-mark', `friction-type-${point.type}`);
      span.removeAttribute('data-friction-id');
      span.removeAttribute('data-original');
      span.removeAttribute('data-replacement');
      
      console.log(`Replaced "${originalText}" with "${finalReplacement}"`);
    }
    
  } else {
    // Case 3: No valid replacement or translated sentence - just remove the friction mark
    console.log(`No valid replacement available for "${point.original}"`);
    
    const span = inputText.querySelector(`.friction-mark[data-friction-id="${id}"]`);
    if (span) {
      // Just remove the friction styling
      span.classList.remove('friction-mark', `friction-type-${point.type}`);
      span.removeAttribute('data-friction-id');
      span.removeAttribute('data-original');
      span.removeAttribute('data-replacement');
    }
  }

  // Always remove only THIS specific point
  frictionPoints = frictionPoints.filter(p => p.id !== id);
  
  // Always remove only THIS specific suggestion
  removeSuggestion(id);

  // Update suggestion count
  updateSuggestionCount();
  
  // Re-analyze after a short delay to get fresh friction points
  // setTimeout(() => {
  //   analyzeTextForFriction();
  // }, 2000);
}

/**
 * Replace an entire sentence in the editor with new text
 * This preserves other friction marks in the DOM
 */
function replaceSentenceInEditor(originalSentence, translatedSentence) {
  console.log('=== CLEAN SENTENCE REPLACEMENT ===');
  console.log(`Original sentence: "${originalSentence}"`);
  console.log(`Translated sentence: "${translatedSentence}"`);
  
  // Get the current plain text
  const currentText = inputText.innerText;
  console.log(`Current text: "${currentText}"`);
  
  // Find the sentence
  const sentenceIndex = currentText.indexOf(originalSentence);
  
  if (sentenceIndex === -1) {
    console.warn(`Could not find sentence in text`);
    return;
  }
  
  // Store friction points from other sentences
  const otherFrictionPoints = frictionPoints.filter(p => 
    p.original_sentence !== originalSentence
  );
  
  console.log(`Preserving ${otherFrictionPoints.length} friction points`);
  
  // Replace the sentence
  const beforeSentence = currentText.substring(0, sentenceIndex);
  const afterSentence = currentText.substring(sentenceIndex + originalSentence.length);
  const newText = beforeSentence + translatedSentence + afterSentence;
  
  console.log(`New text created`);
  
  // Clear the editor and set the new text
  inputText.innerHTML = '';
  
  // Set the text content, preserving line breaks
  inputText.innerText = newText;
  
  console.log(`Text updated in editor`);
  
  // Wait a bit longer for the DOM to settle, then re-mark friction points
  setTimeout(() => {
    reMarkFrictionPointsClean(otherFrictionPoints, newText);
  }, 200);
  
  console.log('=== END CLEAN REPLACEMENT ===');
}



/**
 * Convert plain text to HTML while preserving line breaks
 */
function convertTextToHTMLWithBreaks(text) {
  // Split by line breaks and create HTML
  const lines = text.split('\n');
  
  // Convert each line, preserving empty lines as <br> tags
  const htmlLines = lines.map((line, index) => {
    if (line.trim() === '') {
      return '<br>';
    } else {
      // Escape HTML characters in the line
      const escapedLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      return escapedLine;
    }
  });
  
  // Join with line breaks
  return htmlLines.join('\n');
}
function reMarkFrictionPointsClean(points, fullText) {
  if (!points || points.length === 0) {
    console.log('No friction points to re-mark');
    return;
  }
  
  console.log(`=== CLEAN RE-MARKING ${points.length} FRICTION POINTS ===`);
  
  // Verify the text matches what we expect
  const editorText = inputText.innerText;
  if (editorText !== fullText) {
    console.warn(`Editor text doesn't match expected!`);
    console.log(`Expected: "${fullText}"`);
    console.log(`Editor: "${editorText}"`);
    fullText = editorText; // Use what's actually in the editor
  }
  
  // Find positions for friction points
  const validPoints = [];
  let searchPos = 0;
  
  points.forEach(point => {
    const pos = fullText.indexOf(point.original, searchPos);
    if (pos !== -1) {
      validPoints.push({
        ...point,
        position: pos,
        endPosition: pos + point.original.length
      });
      searchPos = pos + point.original.length;
      console.log(`Found "${point.original}" at position ${pos}`);
    } else {
      console.warn(`Could not find "${point.original}" in new text`);
    }
  });
  
  if (validPoints.length === 0) {
    console.log('No valid friction points to mark');
    return;
  }
  
  // Sort by position
  validPoints.sort((a, b) => a.position - b.position);
  
  // Clear the editor and rebuild with friction marks
  inputText.innerHTML = '';
  
  let cursor = 0;
  
  validPoints.forEach(point => {
    // Add text before this friction point
    if (point.position > cursor) {
      const beforeText = fullText.substring(cursor, point.position);
      addTextWithLineBreaks(beforeText, inputText);
    }
    
    // Create friction mark span
    const span = document.createElement('span');
    span.className = `friction-mark friction-type-${point.type}`;
    span.dataset.frictionId = point.id;
    span.dataset.original = point.original;
    span.dataset.replacement = point.replacement || '';
    span.textContent = point.original;
    
    // Add click event
    span.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const frictionId = this.dataset.frictionId;
      if (frictionId) {
        highlightSuggestion(frictionId);
      }
    });
    
    inputText.appendChild(span);
    cursor = point.endPosition;
    
    console.log(`Added friction mark for "${point.original}"`);
  });
  
  // Add remaining text
  if (cursor < fullText.length) {
    const remainingText = fullText.substring(cursor);
    addTextWithLineBreaks(remainingText, inputText);
  }
  
  console.log(`=== CLEAN RE-MARKING COMPLETED ===`);
  console.log(`Final editor text: "${inputText.innerText}"`);
}

/**
 * Add text to container while preserving line breaks as <br> elements
 */
function addTextWithLineBreaks(text, container) {
  if (!text) return;
  
  // Split by line breaks
  const lines = text.split('\n');
  
  lines.forEach((line, index) => {
    // Add the text content
    if (line.length > 0) {
      container.appendChild(document.createTextNode(line));
    }
    
    // Add <br> for line breaks (except for the last line)
    if (index < lines.length - 1) {
      container.appendChild(document.createElement('br'));
    }
  });
}
/**
 * Re-mark friction points in the HTML structure
 */
function reMarkFrictionPointsInHTML(points) {
  if (!points || points.length === 0) {
    console.log('No friction points to re-mark in HTML');
    return;
  }
  
  console.log(`Re-marking ${points.length} friction points in HTML`);
  
  // Get the current HTML and text
  let currentHTML = inputText.innerHTML;
  const currentText = inputText.innerText;
  
  console.log(`Current HTML: "${currentHTML}"`);
  console.log(`Current text: "${currentText}"`);
  
  // Find each friction point and wrap it with a span
  points.forEach(point => {
    const position = currentText.indexOf(point.original);
    
    if (position !== -1) {
      console.log(`Marking "${point.original}" at position ${position}`);
      
      // Create the friction mark HTML
      const frictionHTML = `<span class="friction-mark friction-type-${point.type}" 
        data-friction-id="${point.id}" 
        data-original="${escapeHtml(point.original)}" 
        data-replacement="${escapeHtml(point.replacement || '')}">${escapeHtml(point.original)}</span>`;
      
      // Replace the first occurrence of this text with the marked version
      // Use a more specific replacement to avoid replacing the wrong instance
      const regex = new RegExp(escapeRegExp(point.original), '');
      currentHTML = currentHTML.replace(regex, frictionHTML);
      
      console.log(`Replaced "${point.original}" with friction mark`);
    } else {
      console.warn(`Could not find "${point.original}" in text for marking`);
    }
  });
  
  // Update the editor with the marked HTML
  inputText.innerHTML = currentHTML;
  
  console.log(`Final HTML: "${inputText.innerHTML}"`);
  
  // Add click events to all friction marks
  const frictionMarks = inputText.querySelectorAll('.friction-mark');
  frictionMarks.forEach(mark => {
    mark.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const frictionId = this.dataset.frictionId;
      if (frictionId) {
        highlightSuggestion(frictionId);
      }
    });
  });
  
  console.log(`Added click events to ${frictionMarks.length} friction marks`);
}

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



/**
 * Replace an entire sentence in the editor with new text
 * This preserves other friction marks in the DOM
 */
/**
 * Replace an entire sentence in the editor with new text
 * More robust version that handles DOM elements and spacing
 */
// function replaceSentenceInEditor(originalSentence, translatedSentence) {
//   console.log('=== ROBUST SENTENCE REPLACEMENT ===');
//   console.log(`Original sentence: "${originalSentence}"`);
//   console.log(`Translated sentence: "${translatedSentence}"`);
  
//   // Get the current text content (this strips HTML but preserves the actual text)
//   const fullText = inputText.innerText;
//   console.log(`Full text: "${fullText}"`);
  
//   // Find the sentence in the text
//   let sentenceIndex = fullText.indexOf(originalSentence);
  
//   // If exact match not found, try with normalized whitespace
//   if (sentenceIndex === -1) {
//     const normalizedOriginal = originalSentence.replace(/\s+/g, ' ').trim();
//     const normalizedFull = fullText.replace(/\s+/g, ' ');
//     sentenceIndex = normalizedFull.indexOf(normalizedOriginal);
//     console.log(`Exact match not found, trying normalized. Found at: ${sentenceIndex}`);
//   }
  
//   if (sentenceIndex === -1) {
//     console.warn(`Could not find sentence in text at all`);
    
//     // Fallback: Try to find by looking for key words from the sentence
//     const keyWords = originalSentence.split(' ').filter(word => word.length > 3);
//     console.log(`Looking for key words:`, keyWords);
    
//     // Find approximate location
//     for (let word of keyWords) {
//       const wordIndex = fullText.indexOf(word);
//       if (wordIndex !== -1) {
//         console.log(`Found key word "${word}" at position ${wordIndex}`);
//         // This is a very rough approximation - in practice you'd want more sophisticated logic
//         break;
//       }
//     }
    
//     return;
//   }
  
//   // Store friction points that are NOT in this sentence
//   const otherFrictionPoints = frictionPoints.filter(p => 
//     p.original_sentence !== originalSentence
//   );
  
//   console.log(`Preserving ${otherFrictionPoints.length} friction points from other sentences`);
  
//   // Calculate the new text
//   const beforeSentence = fullText.substring(0, sentenceIndex);
//   const afterSentence = fullText.substring(sentenceIndex + originalSentence.length);
//   const newText = beforeSentence + translatedSentence + afterSentence;
  
//   console.log(`Replacement details:`);
//   console.log(`  Before (${beforeSentence.length} chars): "${beforeSentence}"`);
//   console.log(`  Original (${originalSentence.length} chars): "${originalSentence}"`);
//   console.log(`  Replacement (${translatedSentence.length} chars): "${translatedSentence}"`);
//   console.log(`  After (${afterSentence.length} chars): "${afterSentence}"`);
//   console.log(`  New text (${newText.length} chars): "${newText}"`);
  
//   // IMPORTANT: Clear the editor completely first
//   inputText.innerHTML = '';
  
//   // Set the new text content
//   inputText.innerText = newText;
  
//   console.log(`Text replacement completed. New content: "${inputText.innerText}"`);
  
//   // Re-mark friction points after a delay to ensure DOM is updated
//   setTimeout(() => {
//     console.log('Starting re-marking process...');
//     reMarkFrictionPoints(otherFrictionPoints, newText);
//   }, 150);
  
//   console.log('=== END SENTENCE REPLACEMENT ===');
// }

// /**
//  * More robust re-marking function
//  */
// function reMarkFrictionPoints(points, fullText) {
//   if (!points || points.length === 0) {
//     console.log('No friction points to re-mark');
//     return;
//   }
  
//   console.log(`=== RE-MARKING ${points.length} FRICTION POINTS ===`);
//   console.log(`Full text for re-marking (${fullText.length} chars): "${fullText}"`);
  
//   // Verify the editor content matches our expectation
//   const editorText = inputText.innerText;
//   if (editorText !== fullText) {
//     console.warn(`Editor text doesn't match expected text!`);
//     console.log(`Expected: "${fullText}"`);
//     console.log(`Editor: "${editorText}"`);
//     // Use the actual editor text
//     fullText = editorText;
//   }
  
//   // Clear and rebuild the editor content with friction marks
//   inputText.innerHTML = '';
  
//   // Find positions for all friction points
//   const pointsWithPositions = [];
//   let searchCursor = 0;
  
//   points.forEach((point, index) => {
//     // Find this friction word in the text, starting from where we left off
//     const position = fullText.indexOf(point.original, searchCursor);
    
//     if (position !== -1) {
//       pointsWithPositions.push({
//         ...point,
//         position: position,
//         endPosition: position + point.original.length
//       });
      
//       // Move cursor past this word to avoid finding the same word again
//       searchCursor = position + point.original.length;
      
//       console.log(`Found "${point.original}" at position ${position}-${position + point.original.length}`);
//     } else {
//       console.warn(`Could not find "${point.original}" in updated text starting from position ${searchCursor}`);
      
//       // Try finding it from the beginning as a fallback
//       const fallbackPos = fullText.indexOf(point.original);
//       if (fallbackPos !== -1) {
//         console.log(`Found "${point.original}" at fallback position ${fallbackPos}`);
//         pointsWithPositions.push({
//           ...point,
//           position: fallbackPos,
//           endPosition: fallbackPos + point.original.length
//         });
//       }
//     }
//   });
  
//   // Sort by position
//   pointsWithPositions.sort((a, b) => a.position - b.position);
  
//   console.log(`Successfully positioned ${pointsWithPositions.length} friction points`);
  
//   // Build the DOM with friction marks
//   let cursor = 0;
  
//   pointsWithPositions.forEach((point, index) => {
//     // Add text before this friction point
//     if (point.position > cursor) {
//       const beforeText = fullText.substring(cursor, point.position);
//       if (beforeText) {
//         inputText.appendChild(document.createTextNode(beforeText));
//         console.log(`Added text: "${beforeText}"`);
//       }
//     }
    
//     // Create and add friction mark span
//     const frictionSpan = document.createElement('span');
//     frictionSpan.className = `friction-mark friction-type-${point.type}`;
//     frictionSpan.dataset.frictionId = point.id;
//     frictionSpan.dataset.original = point.original;
//     frictionSpan.dataset.replacement = point.replacement || '';
//     frictionSpan.textContent = point.original;
    
//     // Add click event
//     frictionSpan.addEventListener('click', function(e) {
//       e.preventDefault();
//       e.stopPropagation();
//       const frictionId = this.dataset.frictionId;
//       if (frictionId) {
//         highlightSuggestion(frictionId);
//       }
//     });
    
//     inputText.appendChild(frictionSpan);
//     cursor = point.endPosition;
    
//     console.log(`Added friction mark for "${point.original}"`);
//   });
  
//   // Add any remaining text
//   if (cursor < fullText.length) {
//     const remainingText = fullText.substring(cursor);
//     if (remainingText) {
//       inputText.appendChild(document.createTextNode(remainingText));
//       console.log(`Added remaining text: "${remainingText}"`);
//     }
//   }
  
//   console.log(`=== RE-MARKING COMPLETED ===`);
//   console.log(`Final editor content: "${inputText.innerText}"`);
// }
  
  /**
   * Ignore a suggestion
   */
/**
 * Ignore a suggestion - removes it from tracking and UI
 */
function ignoreSuggestion(id) {
  console.log(`Ignoring suggestion: ${id}`);
  
  // Find the friction point being ignored
  const ignoredPoint = frictionPoints.find(p => p.id === id);
  if (ignoredPoint) {
    console.log(`Ignoring "${ignoredPoint.original}" (${ignoredPoint.type})`);
  }
  
  // Remove the friction point from our tracking
  frictionPoints = frictionPoints.filter(p => p.id !== id);
  
  // Remove the visual friction mark from the text
  const frictionMark = inputText.querySelector(`.friction-mark[data-friction-id="${id}"]`);
  if (frictionMark) {
    // Remove the friction styling but keep the text
    const textContent = frictionMark.textContent;
    frictionMark.replaceWith(document.createTextNode(textContent));
    console.log(`Removed friction mark for "${textContent}"`);
  }
  
  // Remove the suggestion from the panel
  removeSuggestion(id);
  
  // Update suggestion count
  updateSuggestionCount();
  
  console.log(`Suggestion ignored. Remaining friction points: ${frictionPoints.length}`);
}

/**
 * Remove a suggestion from the panel with animation
 */
function removeSuggestion(id) {
  const suggestionItem = frictionWordsList.querySelector(`[data-friction-id="${id}"]`);
  if (!suggestionItem) {
    console.warn(`Could not find suggestion item with id: ${id}`);
    return;
  }
  
  console.log(`Removing suggestion card: ${id}`);
  
  // Add fade-out animation
  suggestionItem.classList.add('suggestion-item-removed');
  
  // Remove after animation completes
  setTimeout(() => {
    if (suggestionItem.parentNode) {
      suggestionItem.parentNode.removeChild(suggestionItem);
      console.log(`Suggestion card removed: ${id}`);
    }
    
    // Check if we need to clean up the UI
    checkAndCleanupSuggestionsUI();
  }, 300);
}

/**
 * Check and cleanup the suggestions UI if needed
 */
function checkAndCleanupSuggestionsUI() {
  // Remove category header if no more friction points
  if (frictionPoints.length === 0) {
    const categoryHeader = frictionWordsList.querySelector('.suggestion-category');
    if (categoryHeader) {
      categoryHeader.remove();
      console.log('Removed category header - no more friction points');
    }
  }
  
  // Count remaining suggestion items (excluding headers and empty messages)
  const remainingSuggestions = frictionWordsList.querySelectorAll('.suggestion-item:not(.suggestion-item-removed)');
  
  // If no suggestions left at all, show empty message
  if (remainingSuggestions.length === 0 && frictionPoints.length === 0) {
    frictionWordsList.innerHTML = `
      <div class="no-suggestions" style="text-align:center; padding:20px; color:var(--text-tertiary);">
        No suggestions found
      </div>
    `;
    console.log('Showing "no suggestions" message');
  }
}

/**
 * Update the suggestion count in the UI
 */
function updateSuggestionCount() {
  const suggestionCount = document.getElementById('suggestionCount');
  if (suggestionCount) {
    suggestionCount.textContent = frictionPoints.length;
    console.log(`Updated suggestion count: ${frictionPoints.length}`);
  }
}
  
  /**
   * Show alternative options for a suggestion
   */
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
  
  // Show loading state
  optionsContainer.style.display = 'block';
  optionsContainer.innerHTML = `<div class="options-loading"><i class="fas fa-spinner fa-spin"></i> Loading options...</div>`;
  
  // Fetch alternatives from API
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
    
    // Create options list
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
    
    // Add event listeners to buttons
    optionsContainer.querySelectorAll('.option-accept-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const altIndex = parseInt(this.dataset.altIndex);
        const alternative = data.alternatives[altIndex];
        
        console.log(`Selected alternative "${alternative}" for "${point.original}"`);
        
        // Apply the alternative using the same logic as acceptSuggestion
        applyAlternativeSuggestion(point.id, alternative);
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
 * Apply an alternative suggestion (similar to acceptSuggestion but with custom replacement)
 */
function applyAlternativeSuggestion(id, customReplacement) {
  console.log(`Applying alternative suggestion for ${id}: "${customReplacement}"`);
  
  // Find the friction point
  const point = frictionPoints.find(p => p.id === id);
  if (!point) {
    console.warn(`Could not find friction point with id: ${id}`);
    return;
  }
  
  // Check if the custom replacement is empty or just whitespace
  const hasValidReplacement = customReplacement && customReplacement.trim() !== '';
  
  if (!hasValidReplacement && point.translated_sentence) {
    // Case 1: Empty replacement - replace entire sentence with translated version
    console.log(`Empty alternative replacement, using translated sentence`);
    replaceSentenceInEditor(point.original_sentence, point.translated_sentence);
    
    // Remove all friction points that belonged to this sentence
    const removedPoints = frictionPoints.filter(p => 
      p.original_sentence === point.original_sentence
    );
    
    frictionPoints = frictionPoints.filter(p => 
      p.original_sentence !== point.original_sentence
    );
    
    // Remove suggestion cards for this sentence
    removedPoints.forEach(removedPoint => {
      const card = document.querySelector(`[data-friction-id="${removedPoint.id}"]`);
      if (card) {
        card.remove();
      }
    });
    
  } else if (hasValidReplacement) {
    // Case 2: Valid replacement - replace just the friction word/phrase
    console.log(`Valid alternative replacement: "${point.original}" → "${customReplacement}"`);
    
    const span = inputText.querySelector(`.friction-mark[data-friction-id="${id}"]`);
    if (span) {
      // Get the original text content to preserve spacing
      const originalText = span.textContent;
      let finalReplacement = customReplacement;
      
      // Preserve leading/trailing spaces from the original
      if (originalText.startsWith(' ')) {
        finalReplacement = ' ' + finalReplacement;
      }
      if (originalText.endsWith(' ')) {
        finalReplacement = finalReplacement + ' ';
      }
      
      // Replace the span content with the alternative text
      span.textContent = finalReplacement;
      
      // Remove friction styling but keep the span as regular text
      span.classList.remove('friction-mark', `friction-type-${point.type}`);
      span.removeAttribute('data-friction-id');
      span.removeAttribute('data-original');
      span.removeAttribute('data-replacement');
      
      console.log(`Replaced "${originalText}" with "${finalReplacement}"`);
    } else {
      console.warn(`Could not find friction mark span for id: ${id}`);
    }
    
    // Remove this specific point and its suggestion card
    frictionPoints = frictionPoints.filter(p => p.id !== id);
    removeSuggestion(id);
    
  } else {
    // Case 3: No valid replacement - just remove the friction mark
    console.log(`No valid alternative replacement available`);
    
    const span = inputText.querySelector(`.friction-mark[data-friction-id="${id}"]`);
    if (span) {
      // Remove friction styling but keep the original text
      span.classList.remove('friction-mark', `friction-type-${point.type}`);
      span.removeAttribute('data-friction-id');
      span.removeAttribute('data-original');
      span.removeAttribute('data-replacement');
    }
    
    // Remove this specific point and its suggestion card
    frictionPoints = frictionPoints.filter(p => p.id !== id);
    removeSuggestion(id);
  }
  
  // Update suggestion count
  updateSuggestionCount();
  
  console.log(`Alternative suggestion applied successfully`);
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