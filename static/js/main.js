/**
 * Main JavaScript for Friction Language Translator
 * Handles core functionality including text translation, file upload, and UI interactions
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get elements
    const translateBtn = document.getElementById('translateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const inputText = document.getElementById('inputText');
    const originalText = document.getElementById('originalText');
    const translatedText = document.getElementById('translatedText');
    const loader     = document.getElementById('tcLoader');
    const frictionWordsList = document.getElementById('frictionWordsList');
    const highlightToggle = document.getElementById('highlightToggle');
    const resultsContainer = document.getElementById('resultsContainer');
    const promptModal = document.getElementById('promptModal');
    const promptContent = document.getElementById('promptContent');
    const docTitle = document.getElementById('docTitle');
    const contentArea = document.getElementById('contentArea');
    const emptyAnalysis = document.getElementById('emptyAnalysis');
    const fileInput = document.getElementById('fileInput');
    const emptyState = document.querySelector('.empty-state');
    const liveSuggestions = document.getElementById('liveSuggestions');
    const promptBadge = document.querySelector('.prompt-badge');

    // Set up event listeners for the modal
    const modalCloseBtn = document.querySelector('.modal-close');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', () => {
            promptModal.classList.remove('active');
        });
    }

    if (promptModal) {
        promptModal.addEventListener('click', (e) => {
            if (e.target === promptModal) {
                promptModal.classList.remove('active');
            }
        });
    }

    // Function to show the prompt modal
    function showPromptModal(promptText) {
        if (promptContent) promptContent.textContent = promptText;
        if (promptModal) promptModal.classList.add('active');
    }

    // Add click event to the prompt badge
    if (promptBadge) {
        promptBadge.addEventListener('click', function() {
            // Show the prompt modal
            if (promptModal) {
                promptModal.classList.add('active');
                
                // Set the content
                if (promptContent) {
                    promptContent.textContent = getCurrentPromptText();
                }
            }
        });
    }

    // Helper function to get the current prompt text
    function getCurrentPromptText() {
        // Display examples of the different prompt types
        const promptTypes = {
            'but': `You are a specialized language transformation assistant that focuses only on improving sentences containing the word 'but'.

CONTEXT:
- The word "but" can create friction in communication by negating what comes before it
- In some contexts, "but" should be replaced with alternatives like "and" or "and at the same time"
- In other contexts, "but" should be left unchanged when it means "only" or "except"

INSTRUCTIONS:
1. Analyze sentences containing 'but'
2. Determine if 'but' is being used:
   - As a contrasting conjunction (replace with 'and at the same time' or similar)
   - As a synonym for 'only' or 'merely' (leave as 'but')
   - As part of 'not only...but also' construction (replace with 'and also')
   - As meaning 'except for' (replace with 'except')
3. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I like the idea, but I think we need more time." → "I like the idea, and at the same time I think we need more time."
- "He is but a child." → "He is but a child." (unchanged)
- "Everyone is invited but John." → "Everyone is invited except John."
- "Not only is she smart, but she also studies hard." → "She is smart and she also studies hard."

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:`,

            'should': `You are a specialized language transformation assistant that focuses only on improving sentences containing modal verbs like "should", "could", "would" and phrases like "we need to".

CONTEXT:
- Modal verbs like "should", "could", and "would" can create friction in communication by implying obligation
- The translation depends on the context and level of optionality needed
- "We need to" phrases often imply obligation that should be made clear

INSTRUCTIONS:
1. Analyze sentences containing modal verbs or "we need to" phrases
2. Determine the appropriate translation based on context:
   - High optionality contexts (personal preferences, beliefs): "should" → "might"
   - Moderate optionality contexts (recommendations, suggestions): "should" → "recommend"
   - Low optionality contexts (critical actions, values): "should" → "must" or "want you to"
   - "We need to" phrases → "I want you to" or "You must" depending on context
3. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "You shouldn't ignore the signs of declining employee morale." → "You might not ignore the signs of declining employee morale."
- "He wouldn't compromise his values for short-term success." → "He must not compromise his values for short-term success."
- "You should always follow through on your commitments." → "I recommend you always follow through on your commitments."
- "We need to focus on rebuilding trust in leadership." → "I want you to focus on rebuilding trust in leadership."

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:`,

            'not': `You are a specialized language transformation assistant that focuses only on improving sentences containing negative constructions.

CONTEXT:
- Negative words like "not", "don't", "can't", "won't", "never", "without", etc. can create friction in communication
- The goal is to rephrase sentences to reflect what "is" rather than what "is not"
- Keep the original meaning intact while making the language more positive and action-oriented

INSTRUCTIONS:
1. Analyze sentences containing negative constructions
2. Determine how to transform them into positive statements that maintain the original meaning
3. Pay special attention to these patterns:
   - "don't want to" → express what is wanted instead
   - "can't" → express abilities or alternatives
   - "never" → express frequency or difficulty
   - "not" → express the opposite quality
4. Return ONLY the transformed sentence without any explanations

EXAMPLES:
- "I don't want to go" → "I want to stay home"
- "I don't want to go to the movies" → "I want to go somewhere besides the movies"
- "I don't care" → "I am indifferent"
- "It will never work" → "It's going to be hard to make it work"
- "I can't wait for tomorrow" → "I am looking forward to tomorrow"

SENTENCE TO TRANSFORM:
{text}

TRANSFORMED SENTENCE:`
        };
        
        // Return all prompt types with headers
        return Object.entries(promptTypes)
            .map(([type, prompt]) => `## ${type.toUpperCase()} TRANSLATOR\n\n${prompt}`)
            .join('\n\n' + '-'.repeat(40) + '\n\n');
    }

    // Function to update document title based on input
    if (inputText && docTitle) {
        inputText.addEventListener('input', function() {
            const text = this.value.trim();
            if (text) {
                // Get first line or first few words for the title
                const firstLine = text.split('\n')[0];
                const title = firstLine.length > 30 ? firstLine.substring(0, 30) + '...' : firstLine;
                docTitle.textContent = title;
                if (emptyState) emptyState.style.display = 'none';
            } else {
                docTitle.textContent = 'Untitled document';
                if (emptyState) emptyState.style.display = 'flex';
            }
        });
    }

    // Handle file upload
    if (fileInput && inputText) {
        fileInput.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                // Update document title
                if (docTitle) docTitle.textContent = file.name;
                
                // Show loading state in the text area
                inputText.value = "Loading document content...";
                if (emptyState) emptyState.style.display = 'none';
                
                // Here you would normally have server-side processing for document parsing
                // For this demo, we'll simulate document loading for text files
                if (file.type === "text/plain") {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        inputText.value = e.target.result;
                        
                        // Trigger input event to analyze the text
                        const inputEvent = new Event('input', { bubbles: true });
                        inputText.dispatchEvent(inputEvent);
                    };
                    reader.readAsText(file);
                } else {
                    // For other file types, you'd typically send to the server for processing
                    // Simulating for the demo
                    setTimeout(() => {
                        inputText.value = `Content extracted from ${file.name}.\n\nThis is a simulated content extraction for demo purposes. In a real implementation, the server would parse the document and extract the text content.`;
                        
                        // Trigger input event to analyze the text
                        const inputEvent = new Event('input', { bubbles: true });
                        inputText.dispatchEvent(inputEvent);
                    }, 1000);
                }
            }
        });
    }
    
    // Add event listener for translate button
    if (translateBtn && inputText) {
        translateBtn.addEventListener('click', function() {
          const text = inputText.innerText.trim();
          if (!text) return;
      
          // Button loading state
          translateBtn.disabled  = true;
          translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';
      
          // Show results container, hide empty states
          resultsContainer && (resultsContainer.style.display = 'block');
          emptyState      && (emptyState.style.display      = 'none');
          emptyAnalysis   && (emptyAnalysis.style.display   = 'none');
          liveSuggestions && (liveSuggestions.style.display = 'block');
      
          // Spinner & text toggle
          const loader = document.getElementById('tcLoader');
          const output = document.getElementById('translatedText');
          loader && (loader.style.display        = 'block');
          output && (output.style.display        = 'none');
          frictionWordsList && (frictionWordsList.innerHTML = '');
      
          const highlightChanges = highlightToggle && highlightToggle.checked;
      
          fetch('/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, highlight: highlightChanges })
          })
          .then(resp => {
            if (!resp.ok) throw new Error(resp.statusText);
            return resp.json();
          })
          .then(data => {
            originalText && (originalText.textContent = data.original);
      
            if (output) {
              if (highlightChanges && data.highlighted) {
                output.innerHTML = data.highlighted.trim();
              } else {
                output.textContent = data.translated.trim();
              }
            }
      
            displayTranslationResults(data);
          })
          .catch(err => {
            console.error('Translate error', err);
            output && (output.textContent = 'An error occurred. Please try again.');
          })
          .finally(() => {
            // Hide spinner, show text
            loader && (loader.style.display        = 'none');
            output && (output.style.display        = 'block');
      
            // Reset button
            translateBtn.disabled  = false;
            translateBtn.innerHTML = '<i class="fas fa-magic"></i> Translate';
          });
        });
      }
      

    /**
     * Display translation results in the sidebar
     * @param {Object} data - The data returned from the translation API
     */
    function displayTranslationResults(data) {
        if (!frictionWordsList) return;
      
        // 1) clear out any old cards
        frictionWordsList.innerHTML = '';
      
        // 2) render ONLY the actual transformations
        if (data.transformations && data.transformations.length > 0) {
          data.transformations.forEach(trans => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.setAttribute('data-category', getCategoryForFrictionType(trans.type));
      
            // Suggestion line (use replacement if there is one, otherwise show original)
            const s = document.createElement('div');
            s.className = 'suggestion-text';
            const suggestionText = trans.replacement || trans.original;
            s.innerHTML = `<strong>Suggestion:</strong> ${escapeHtml(suggestionText)}`;
            item.appendChild(s);
      
            // Correction line
            const c = document.createElement('div');
            c.className = 'suggestion-text';
            c.innerHTML = `<strong>Correction:</strong> "${escapeHtml(trans.original)}" → "${escapeHtml(trans.replacement || '')}"`;
            item.appendChild(c);
      
            // Ignore button
            const actions = document.createElement('div');
            actions.className = 'suggestion-actions';
            // const ignoreBtn = document.createElement('button');
            // ignoreBtn.className = 'suggestion-action';
            // ignoreBtn.textContent = 'Ignore';
            // ignoreBtn.addEventListener('click', e => {
            //   e.stopPropagation();
            //   item.remove();
            //   updateSuggestionCounts();
            // });
            // actions.appendChild(ignoreBtn);
      
            item.appendChild(actions);
            frictionWordsList.appendChild(item);
          });
        } else {
          // no real transformations? show “none”
          frictionWordsList.innerHTML = `
            <div class="no-suggestions" style="text-align:center; padding:20px; color:var(--text-tertiary);">
              No suggestions found
            </div>
          `;
        }
      
        // 3) refresh the little counter
        updateSuggestionCounts();
      }
      
      
      
    // function displayTranslationResults(data) {
    //     if (!frictionWordsList) return;

    //     // Clear the friction words list
    //     frictionWordsList.innerHTML = '';

    //     // Check if we have friction words to display
    //     if (data.friction_words && data.friction_words.length > 0) {
    //         // Create suggestion items for each friction word
    //         data.friction_words.forEach(word => {
    //             const category = getCategoryForFrictionType(word.type);
    //             const suggestionItem = document.createElement('div');
    //             suggestionItem.className = 'suggestion-item';
    //             suggestionItem.setAttribute('data-category', category);
                
    //             // Create the header with icon and title
    //             // const header = document.createElement('div');
    //             // header.className = 'suggestion-item-header';
                
    //             // const icon = document.createElement('div');
    //             // icon.className = `suggestion-icon suggestion-icon-${category}`;
                
    //             // // Set icon based on type
    //             // switch (word.type) {
    //             //     case 'but':
    //             //         icon.innerHTML = '<i class="fas fa-exchange-alt"></i>';
    //             //         break;
    //             //     case 'should':
    //             //         icon.innerHTML = '<i class="fas fa-exclamation"></i>';
    //             //         break;
    //             //     case 'not':
    //             //         icon.innerHTML = '<i class="fas fa-times"></i>';
    //             //         break;
    //             //     default:
    //             //         icon.innerHTML = '<i class="fas fa-language"></i>';
    //             // }
                
    //             // const title = document.createElement('div');
    //             // title.className = 'suggestion-title';
    //             // title.textContent = `Replace "${word.original}"`;
    //             // header.appendChild(icon);
    //             // header.appendChild(title);
    //             // suggestionItem.appendChild(header);
                
    //             // // Add description
    //             // const description = document.createElement('div');
    //             // description.className = 'suggestion-text';
                
    //             // if (word.type === 'but') {
    //             //     description.textContent = 'The word "but" can create friction in communication by negating what comes before it.';
    //             // } else if (word.type === 'should') {
    //             //     description.textContent = 'Modal verbs like "should" can create resistance by implying obligation.';
    //             // } else if (word.type === 'not') {
    //             //     description.textContent = 'Negative constructions can create friction by focusing on what is absent rather than present.';
    //             // } else {
    //             //     description.textContent = 'This type of friction language can affect communication clarity.';
    //             // }
                
    //             // suggestionItem.appendChild(description);
                
    //             // Add replacement suggestion
    //             if (word.replacement) {
    //                       const suggestionLine = document.createElement('div');
    //                       suggestionLine.className = 'suggestion-text';
    //                       suggestionLine.innerHTML = `<strong>Suggestion:</strong> "${word.replacement}"`;
    //                       suggestionItem.appendChild(suggestionLine);
    //                     }
                
    //                     if (word.example) {
    //                       const correctionLine = document.createElement('div');
    //                       correctionLine.className = 'suggestion-text';
    //                       if (typeof word.example === 'object') {
    //                         correctionLine.innerHTML = `<strong>Correction:</strong> "${escapeHtml(word.example.from)}" → "${escapeHtml(word.example.to)}"`;
    //                       } else {
    //                         correctionLine.innerHTML = `<strong>Correction:</strong> ${escapeHtml(word.example)}`;
    //                       }
    //                       suggestionItem.appendChild(correctionLine);
    //                     }
                
    //             // Add context if available
    //             if (word.context) {
    //                 const contextDisplay = document.createElement('div');
    //                 contextDisplay.className = 'suggestion-text';
                    
    //                 // Highlight the original phrase within the context
    //                 let contextHtml = escapeHtml(word.context);
    //                 const original = escapeHtml(word.original);
    //                 if (original && contextHtml.includes(original)) {
    //                     contextHtml = contextHtml.replace(
    //                         original, 
    //                         `<span class="suggestion-text-highlight">${original}</span>`
    //                     );
    //                 }
                    
    //                 contextDisplay.innerHTML = `<strong>Context:</strong> ${contextHtml}`;
    //                 suggestionItem.appendChild(contextDisplay);
    //             }
                
    //             // Add view prompt button if available
    //             if (word.prompt) {
    //                 const actions = document.createElement('div');
    //                 actions.className = 'suggestion-actions';
                    
    //                 const viewPromptBtn = document.createElement('button');
    //                 viewPromptBtn.className = 'suggestion-action suggestion-action-primary';
    //                 viewPromptBtn.textContent = 'View LLM prompt';
    //                 viewPromptBtn.addEventListener('click', function(e) {
    //                     e.stopPropagation();
    //                     showPromptModal(word.prompt);
    //                 });
                    
    //                 const ignoreBtn = document.createElement('button');
    //                 ignoreBtn.className = 'suggestion-action';
    //                 ignoreBtn.textContent = 'Ignore';
    //                 ignoreBtn.addEventListener('click', function(e) {
    //                     e.stopPropagation();
    //                     suggestionItem.remove();
    //                     updateSuggestionCounts();
    //                 });
                    
    //                 actions.appendChild(viewPromptBtn);
    //                 actions.appendChild(ignoreBtn);
    //                 suggestionItem.appendChild(actions);
    //             } else {
    //                 // Add a simple ignore button if no prompt
    //                 const actions = document.createElement('div');
    //                 actions.className = 'suggestion-actions';
                    
    //                 const ignoreBtn = document.createElement('button');
    //                 ignoreBtn.className = 'suggestion-action';
    //                 ignoreBtn.textContent = 'Ignore';
    //                 ignoreBtn.addEventListener('click', function(e) {
    //                     e.stopPropagation();
    //                     suggestionItem.remove();
    //                     updateSuggestionCounts();
    //                 });
                    
    //                 actions.appendChild(ignoreBtn);
    //                 suggestionItem.appendChild(actions);
    //             }
                
    //             frictionWordsList.appendChild(suggestionItem);
    //         });
    //     }
        
    //     // If there are specific transformations, show them as well
    //     if (data.transformations && data.transformations.length > 0) {
    //         data.transformations.forEach(trans => {
    //             const category = getCategoryForFrictionType(trans.type);
    //             const transItem = document.createElement('div');
    //             transItem.className = 'suggestion-item';
    //             transItem.setAttribute('data-category', category);
                
    //             // Create the header with icon and title
    //             const header = document.createElement('div');
    //             header.className = 'suggestion-item-header';
                
    //             const icon = document.createElement('div');
    //             icon.className = `suggestion-icon suggestion-icon-${category}`;
                
    //             // Set icon based on type
    //             switch (trans.type) {
    //                 case 'but':
    //                     icon.innerHTML = '<i class="fas fa-exchange-alt"></i>';
    //                     break;
    //                 case 'should':
    //                     icon.innerHTML = '<i class="fas fa-exclamation"></i>';
    //                     break;
    //                 case 'not':
    //                     icon.innerHTML = '<i class="fas fa-times"></i>';
    //                     break;
    //                 default:
    //                     icon.innerHTML = '<i class="fas fa-language"></i>';
    //             }
                
    //             const title = document.createElement('div');
    //             title.className = 'suggestion-title';
                
    //             let patternDisplay = '';
    //             if (trans.pattern) {
    //                 patternDisplay = ` (${trans.pattern})`;
    //             }
                
    //             title.textContent = `${trans.type.charAt(0).toUpperCase() + trans.type.slice(1)}${patternDisplay}`;
                
    //             header.appendChild(icon);
    //             header.appendChild(title);
    //             transItem.appendChild(header);
                
    //             // Original text
    //             const transOriginal = document.createElement('div');
    //             transOriginal.className = 'suggestion-text';
    //             transOriginal.textContent = `Original: "${trans.original}"`;
    //             transItem.appendChild(transOriginal);
                
    //             // Replacement
    //             const transReplacement = document.createElement('div');
    //             transReplacement.className = 'suggestion-text';
    //             transReplacement.textContent = `Replaced with: "${trans.replacement || '(Removed)'}"`;
    //             transItem.appendChild(transReplacement);
                
    //             // Context if available
    //             if (trans.context) {
    //                 const contextDisplay = document.createElement('div');
    //                 contextDisplay.className = 'suggestion-text';
                    
    //                 // Highlight the original phrase within the context
    //                 let contextHtml = escapeHtml(trans.context);
    //                 const original = escapeHtml(trans.original);
    //                 if (original && contextHtml.includes(original)) {
    //                     contextHtml = contextHtml.replace(
    //                         original, 
    //                         `<span class="suggestion-text-highlight">${original}</span>`
    //                     );
    //                 }
                    
    //                 contextDisplay.innerHTML = `<strong>Context:</strong> ${contextHtml}`;
    //                 transItem.appendChild(contextDisplay);
    //             }
                
    //             // Add actions
    //             const actions = document.createElement('div');
    //             actions.className = 'suggestion-actions';
                
    //             const ignoreBtn = document.createElement('button');
    //             ignoreBtn.className = 'suggestion-action';
    //             ignoreBtn.textContent = 'Ignore';
    //             ignoreBtn.addEventListener('click', function(e) {
    //                 e.stopPropagation();
    //                 transItem.remove();
    //                 updateSuggestionCounts();
    //             });
                
    //             actions.appendChild(ignoreBtn);
    //             transItem.appendChild(actions);
                
    //             frictionWordsList.appendChild(transItem);
    //         });
    //     }
        
    //     // Update the suggestion count
    //     updateSuggestionCounts();
    // }

    /**
     * Update suggestion counts in the UI
     */
    function updateSuggestionCounts() {
        const suggestionCount = document.getElementById('suggestionCount');
        const proSuggestionCount = document.getElementById('proSuggestionCount');
        
        if (suggestionCount) {
            const totalItems = document.querySelectorAll('#frictionWordsList .suggestion-item').length;
            suggestionCount.textContent = totalItems;
        }
        
        if (proSuggestionCount) {
            const proItems = document.querySelectorAll('#proSuggestions .suggestion-item').length;
            proSuggestionCount.textContent = proItems;
        }
    }

    /**
     * Map friction type to a category
     * @param {string} frictionType - The type of friction language
     * @returns {string} - The category (correctness, clarity, engagement)
     */
    function getCategoryForFrictionType(frictionType) {
        switch (frictionType.toLowerCase()) {
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

    // Event listener for highlight toggle
    if (highlightToggle) {
        highlightToggle.addEventListener('change', function() {
          // Grab every <mark> in your translated output
          const marks = document.querySelectorAll('#translatedText mark');
          marks.forEach(mark => {
            // Toggle its background on or off
            mark.style.backgroundColor = highlightToggle.checked
              ? ''          // restore default highlight
              : 'transparent';
          });
      
          // Optional: if you want a full re-translate when no marks exist yet
          if (!marks.length && translatedText.innerText.trim()) {
            translateBtn.click();
          }
        });
    }
      

    // Make category tabs interactive
    const categoryTabs = document.querySelectorAll('.category-tab');
    if (categoryTabs) {
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                categoryTabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                this.classList.add('active');
                
                // Filter suggestions by category
                const category = this.getAttribute('data-category');
                filterSuggestionsByCategory(category);
            });
        });
    }
    
    /**
     * Filter suggestions by category
     * @param {string} category - The category to filter by (all, clarity, engagement, correctness)
     */
    function filterSuggestionsByCategory(category) {
        const items = document.querySelectorAll('.suggestion-item');
        
        items.forEach(item => {
            if (category === 'all' || item.getAttribute('data-category') === category) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // Format buttons functionality
    const formatButtons = document.querySelectorAll('.format-btn');
    if (formatButtons) {
        formatButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Toggle active state visually
                this.classList.toggle('active');
                
                // Focus on the text area
                if (inputText) inputText.focus();
                
                // Get the current selection
                let selectedText = '';
                let selectionStart = inputText.selectionStart;
                let selectionEnd = inputText.selectionEnd;
                
                if (selectionStart !== selectionEnd) {
                    selectedText = inputText.value.substring(selectionStart, selectionEnd);
                }
                
                // Apply basic formatting (this is a simple demo - in a real app you'd use contentEditable or a rich text editor)
                if (selectedText) {
                    let formattedText = selectedText;
                    const buttonTitle = this.getAttribute('title').toLowerCase();
                    
                    // Apply formatting based on button type
                    if (buttonTitle === 'bold') {
                        formattedText = `**${selectedText}**`; // Markdown syntax for bold
                    } else if (buttonTitle === 'italic') {
                        formattedText = `*${selectedText}*`; // Markdown syntax for italic
                    } else if (buttonTitle === 'bullet list') {
                        // Split by line and add bullet points
                        formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
                    } else if (buttonTitle === 'numbered list') {
                        // Split by line and add numbers
                        formattedText = selectedText.split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n');
                    }
                    
                    // Replace the selected text with the formatted text
                    const textBefore = inputText.value.substring(0, selectionStart);
                    const textAfter = inputText.value.substring(selectionEnd);
                    inputText.value = textBefore + formattedText + textAfter;
                    
                    // Reset selection to the new formatted text
                    inputText.selectionStart = selectionStart;
                    inputText.selectionEnd = selectionStart + formattedText.length;
                    
                    // Trigger input event to reanalyze
                    const inputEvent = new Event('input', { bubbles: true });
                    inputText.dispatchEvent(inputEvent);
                }
            });
        });
    }

    // Add event listener for clear button
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (inputText) inputText.value = '';
            if (originalText) originalText.textContent = '';
            if (translatedText) translatedText.textContent = '';
            if (docTitle) docTitle.textContent = 'Untitled document';
            if (resultsContainer) resultsContainer.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            if (fileInput) fileInput.value = ''; // Reset file input
            
            // Reset analysis panel
            if (liveSuggestions) liveSuggestions.style.display = 'none';
            if (emptyAnalysis) emptyAnalysis.style.display = 'flex';
            
            // Reset suggestion count
            const suggestionCount = document.getElementById('suggestionCount');
            if (suggestionCount) suggestionCount.textContent = '0';
            
            const proSuggestionCount = document.getElementById('proSuggestionCount');
            if (proSuggestionCount) proSuggestionCount.textContent = '0';
        });
    }

    // Helper function to escape HTML
    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Initialize UI state
    if (emptyState) emptyState.style.display = 'flex';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (liveSuggestions) liveSuggestions.style.display = 'none';
    
    // Make document title editable
    if (docTitle) {
        docTitle.addEventListener('click', function() {
            const currentTitle = this.textContent;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentTitle;
            input.style.width = '200px';
            input.style.padding = '4px';
            input.style.border = '1px solid var(--border-color)';
            input.style.borderRadius = 'var(--radius-sm)';
            input.style.fontSize = '15px';
            
            this.textContent = '';
            this.appendChild(input);
            input.focus();
            
            const saveTitle = () => {
                this.textContent = input.value || 'Untitled document';
            };
            
            input.addEventListener('blur', saveTitle);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveTitle();
                    e.preventDefault();
                }
            });
        });
    }
    
    // Initialize any translation type buttons in the empty state
    const translationTypes = document.querySelectorAll('.translation-type');
    if (translationTypes) {
        translationTypes.forEach(type => {
            type.addEventListener('click', function() {
                translationTypes.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
            });
        });
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn    = document.getElementById('copyBtn');
    const translated = document.getElementById('translatedText');
    if (!copyBtn || !translated) return;
    function copyToClipboard(text) {
        // 1) Preferred on secure contexts
        if (navigator.clipboard && window.isSecureContext) {
          return navigator.clipboard.writeText(text);
        }
        // 2) Fallback on HTTP
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        let success = false;
        try {
          success = document.execCommand('copy');
        } catch (err) {
          console.error('Fallback copy failed', err);
        }
        document.body.removeChild(textarea);
        return success ? Promise.resolve() : Promise.reject();
    }      

  
    copyBtn.addEventListener('click', () => {
      const text = translated.innerText.trim();
      copyToClipboard(text)
        .then(() => {
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          setTimeout(() => {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          }, 1500);
        })
        .catch(console.error);
    });
  });  
  document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn    = document.getElementById('downloadBtn');
    const downloadForm   = document.getElementById('downloadForm');
    const downloadInput  = document.getElementById('downloadTextInput');
    const filenameInput  = document.getElementById('downloadFilenameInput');
    const translated     = document.getElementById('translatedText');
    const docTitle       = document.getElementById('docTitle');  // ← your header title
  
    if (downloadBtn && downloadForm && downloadInput && filenameInput && translated && docTitle) {
      downloadBtn.addEventListener('click', e => {
        e.preventDefault();
  
        const text = translated.innerText.trim();
        if (!text) return;
  
        // grab the title from the header, e.g. "AUTO" or "Untitled document"
        const rawName = docTitle.innerText.trim();
        downloadInput.value = text;
        filenameInput.value = rawName || 'translation';
  
        downloadForm.submit();
      });
    }
  });
  
  document.addEventListener('DOMContentLoaded', () => {
    const printBtn   = document.getElementById('printBtn');
    const translated = document.getElementById('translatedText');
  
    if (printBtn && translated) {
      printBtn.addEventListener('click', e => {
        e.preventDefault();
  
        // Grab only the inner HTML of the translation body
        const content = translated.innerHTML.trim();
        if (!content) return;
  
        // Open a new tiny window
        const win = window.open('', 'PrintWindow', 'width=600,height=400');
        win.document.write(`
          <html>
            <head>
              <title>Print Translation</title>
              <style>
                /* basic reset */
                body { margin: 1rem; font-family: sans-serif; }
                /* preserve your text-display styling if needed */
                .text-display p { margin-bottom: 0.5em; }
              </style>
            </head>
            <body>
              ${content}
            </body>
          </html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
      });
    }
  });
  