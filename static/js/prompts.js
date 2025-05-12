// /**
//  * LLM Prompt Management - JavaScript
//  * 
//  * This script handles the UI and API interactions for the LLM prompt management page.
//  * It loads, displays, creates, edits, and tests LLM prompts used by the friction language translator.
//  */

// // Load all prompts on page load
// document.addEventListener('DOMContentLoaded', loadPrompts);

// // Close modals when clicking on X or outside the modal
// document.querySelectorAll('.close').forEach(el => {
//     el.addEventListener('click', () => {
//         document.querySelectorAll('.modal').forEach(modal => {
//             modal.style.display = 'none';
//         });
//     });
// });

// window.addEventListener('click', (event) => {
//     document.querySelectorAll('.modal').forEach(modal => {
//         if (event.target === modal) {
//             modal.style.display = 'none';
//         }
//     });
// });

// // Add rule form submission
// document.getElementById('addRuleForm').addEventListener('submit', (event) => {
//     event.preventDefault();
//     const form = event.target;
//     const promptType = document.getElementById('addRuleType').value;
    
//     const data = {
//         name: document.getElementById('addRuleName').value,
//         description: document.getElementById('addRuleDescription').value,
//         prompt: document.getElementById('addRulePrompt').value,
//         example: {
//             from: document.getElementById('addRuleExampleFrom').value,
//             to: document.getElementById('addRuleExampleTo').value
//         }
//     };
    
//     fetch(`/prompts/${promptType}/${data.name}`, {
//         method: 'PUT',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(data)
//     })
//     .then(response => response.json())
//     .then(result => {
//         if (result.success) {
//             closeModal('addRuleModal');
//             loadPrompts();
//         } else {
//             alert(`Error: ${result.message || 'Failed to add prompt'}`);
//         }
//     })
//     .catch(error => {
//         console.error('Error:', error);
//         alert('An error occurred while adding the prompt.');
//     });
// });

// // Edit rule form submission
// document.getElementById('editRuleForm').addEventListener('submit', (event) => {
//     event.preventDefault();
//     const form = event.target;
//     const promptType = document.getElementById('editRuleType').value;
//     const ruleName = document.getElementById('editRuleName').value;
    
//     const data = {
//         description: document.getElementById('editRuleDescription').value,
//         prompt: document.getElementById('editRulePrompt').value,
//         example: {
//             from: document.getElementById('editRuleExampleFrom').value,
//             to: document.getElementById('editRuleExampleTo').value
//         }
//     };
    
//     fetch(`/prompts/${promptType}/${ruleName}`, {
//         method: 'PUT',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify(data)
//     })
//     .then(response => response.json())
//     .then(result => {
//         if (result.success) {
//             closeModal('editRuleModal');
//             loadPrompts();
//         } else {
//             alert(`Error: ${result.message || 'Failed to update prompt'}`);
//         }
//     })
//     .catch(error => {
//         console.error('Error:', error);
//         alert('An error occurred while updating the prompt.');
//     });
// });

// /**
//  * Load all prompts from the server and display them
//  */
// function loadPrompts() {
//     const container = document.getElementById('promptsContainer');
//     container.innerHTML = '<div class="loading">Loading prompts...</div>';
    
//     fetch('/prompts')
//         .then(response => response.json())
//         .then(data => {
//             container.innerHTML = '';
            
//             // Convert object to array of [key, value] pairs and sort by type name
//             const sortedTypes = Object.entries(data).sort((a, b) => {
//                 const typeOrder = { 'but': 1, 'should': 2, 'not': 3 };
//                 return (typeOrder[a[0]] || 99) - (typeOrder[b[0]] || 99);
//             });
            
//             for (const [type, contexts] of sortedTypes) {
//                 const typeEl = document.createElement('div');
//                 typeEl.className = 'prompt-container';
                
//                 let typeDescription = '';
//                 switch(type) {
//                     case 'but':
//                         typeDescription = 'Customize how the LLM handles "but" friction language by providing context-specific prompts.';
//                         break;
//                     case 'should':
//                         typeDescription = 'Configure prompts for modal verbs like "should", "could", "would" and phrases like "we need to".';
//                         break;
//                     case 'not':
//                         typeDescription = 'Define prompts for negative constructions like "not", "don\'t", "can\'t", etc.';
//                         break;
//                     default:
//                         typeDescription = 'Customize LLM prompts for this type of friction language.';
//                 }
                
//                 const typeHeader = `
//                     <div class="prompt-type">
//                         <div class="prompt-type-header">
//                             <h2>${formatTypeName(type)} Prompts</h2>
//                             <button class="add-btn" onclick="openAddRuleModal('${type}')">
//                                 <i class="fas fa-plus"></i> Add Prompt
//                             </button>
//                         </div>
//                         <p>${typeDescription}</p>
//                         <div class="prompt-rules" id="rules-${type}">
//                             ${renderRules(type, contexts)}
//                         </div>
//                     </div>
//                 `;
                
//                 typeEl.innerHTML = typeHeader;
//                 container.appendChild(typeEl);
//             }
//         })
//         .catch(error => {
//             console.error('Error loading prompts:', error);
//             container.innerHTML = '<div class="error" style="text-align: center; padding: 20px; color: #f44336;">Error loading prompts. Please try again.</div>';
//         });
// }

// /**
//  * Render rules for a specific prompt type
//  * @param {string} type - The prompt type (but, should, not)
//  * @param {object} contexts - The context data for the type
//  * @returns {string} - HTML for the rules
//  */
// function renderRules(type, contexts) {
//     if (!contexts || Object.keys(contexts).length === 0) {
//         return '<p style="color: #666; font-style: italic; text-align: center; padding: 15px;">No prompts defined for this type yet.</p>';
//     }
    
//     let html = '';
    
//     // Sort contexts by name for consistent display
//     const sortedContexts = Object.entries(contexts).sort((a, b) => {
//         // Put 'default' at the top
//         if (a[0] === 'default') return -1;
//         if (b[0] === 'default') return 1;
//         return a[0].localeCompare(b[0]);
//     });
    
//     for (const [contextName, contextData] of sortedContexts) {
//         const promptPreview = contextData.prompt.length > 150 ? 
//             contextData.prompt.substring(0, 150) + '...' : 
//             contextData.prompt;
        
//         let exampleHtml = '';
//         if (contextData.example) {
//             if (typeof contextData.example === 'object' && contextData.example.from && contextData.example.to) {
//                 exampleHtml = `
//                     <div class="field">
//                         <label>Example:</label>
//                         <p>"${escapeHtml(contextData.example.from)}" → "${escapeHtml(contextData.example.to)}"</p>
//                     </div>`;
//             } else if (typeof contextData.example === 'string') {
//                 exampleHtml = `
//                     <div class="field">
//                         <label>Example:</label>
//                         <p>${escapeHtml(contextData.example)}</p>
//                     </div>`;
//             }
//         }
        
//         html += `
//             <div class="rule-card">
//                 <div class="rule-header">
//                     <h3>${contextName}</h3>
//                     <div class="rule-actions">
//                         <button class="edit-btn" onclick="openEditRuleModal('${type}', '${contextName}', ${JSON.stringify(contextData).replace(/"/g, '&quot;')})">
//                             <i class="fas fa-edit"></i> Edit
//                         </button>
//                         <button class="delete-btn" onclick="deleteRule('${type}', '${contextName}')">
//                             <i class="fas fa-trash"></i> Delete
//                         </button>
//                         <button class="test-btn" onclick="openTestModal('${type}', '${contextName}', ${JSON.stringify(contextData).replace(/"/g, '&quot;')})">
//                             <i class="fas fa-vial"></i> Test
//                         </button>
//                     </div>
//                 </div>
//                 <div class="rule-content">
//                     <div class="field">
//                         <label>Description:</label>
//                         <p>${contextData.description || 'No description provided'}</p>
//                     </div>
//                     <div class="field">
//                         <label>LLM Prompt Template:</label>
//                         <div class="prompt-preview">${escapeHtml(promptPreview)}</div>
//                         <button class="view-full-btn" onclick="viewFullPrompt(${JSON.stringify(contextData.prompt).replace(/"/g, '&quot;')})">
//                             <i class="fas fa-eye"></i> View Full Prompt
//                         </button>
//                     </div>
//                     ${exampleHtml}
//                 </div>
//             </div>
//         `;
//     }
    
//     return html;
// }

// /**
//  * Open the Add Rule modal for a specific prompt type
//  * @param {string} type - The prompt type (but, should, not)
//  */
// function openAddRuleModal(type) {
//     document.getElementById('addRuleType').value = type;
//     document.getElementById('addRuleForm').reset();
//     document.getElementById('addTestContainer').style.display = 'none';
//     document.getElementById('addTestResult').style.display = 'none';
    
//     // Initialize with default prompt template
//     let defaultPrompt = '';
//     switch(type) {
//         case 'but':
//             defaultPrompt = `You are a specialized translation assistant that focuses only on improving sentences containing the word 'but'.

// CONTEXT:
// - The word 'but' can create friction in communication
// - In some contexts, 'but' should be replaced with alternatives like 'and' or 'and at the same time'
// - In other contexts, 'but' should be left unchanged when it means 'only' or 'except'

// INSTRUCTIONS:
// 1. Analyze the following sentence containing 'but'
// 2. Determine if 'but' is being used:
//    - As a contrasting conjunction (replace with 'and at the same time' or similar)
//    - As a synonym for 'only' or 'merely' (leave as 'but')
//    - As part of 'not only...but also' construction (replace with 'and also')
//    - As meaning 'except for' (replace with 'except')
// 3. Return ONLY the transformed sentence without any explanations

// EXAMPLES:
// - "I like the idea, but I think we need more time." → "I like the idea, and at the same time I think we need more time."
// - "He is but a child." → "He is but a child." (unchanged)
// - "Everyone is invited but John." → "Everyone is invited except John."
// - "Not only is she smart, but she also studies hard." → "She is smart and she also studies hard."

// SENTENCE TO TRANSFORM:
// {text}

// TRANSFORMED SENTENCE:`;
//             break;
//         case 'should':
//             defaultPrompt = `You are a specialized translation assistant that focuses only on improving sentences containing modal verbs like "should", "could", "would" and phrases like "we need to".

// CONTEXT:
// - Modal verbs like "should", "could", and "would" can create friction in communication
// - The translation depends on the context and level of optionality needed
// - "We need to" phrases often imply obligation that should be made clear

// INSTRUCTIONS:
// 1. Analyze the following sentence containing modal verbs or "we need to" phrases
// 2. Determine the appropriate translation based on context:
//    - High optionality contexts (personal preferences, beliefs): "should" → "might"
//    - Moderate optionality contexts (recommendations, suggestions): "should" → "recommend"
//    - Low optionality contexts (critical actions, values): "should" → "must" or "want you to"
//    - "We need to" phrases → "I want you to" or "You must" depending on context
// 3. Return ONLY the transformed sentence without any explanations

// EXAMPLES:
// - "You shouldn't ignore the signs of declining employee morale." → "You might not ignore the signs of declining employee morale."
// - "He wouldn't compromise his values for short-term success." → "He must not compromise his values for short-term success."
// - "She couldn't believe how quickly things had changed." → "She was surprised by how quickly things had changed."
// - "You should always follow through on your commitments." → "I recommend you always follow through on your commitments."
// - "We need to focus on rebuilding trust in leadership." → "I want you to focus on rebuilding trust in leadership."

// SENTENCE TO TRANSFORM:
// {text}

// TRANSFORMED SENTENCE:`;
//             break;
//         case 'not':
//             defaultPrompt = `You are a specialized translation assistant that focuses only on improving sentences containing negative constructions.

// CONTEXT:
// - Negative words like "not", "don't", "can't", "won't", "never", "without", etc. can create friction in communication
// - The goal is to rephrase sentences to reflect what "is" rather than what "is not"
// - Keep the original meaning intact while making the language more positive and action-oriented

// INSTRUCTIONS:
// 1. Analyze the following sentence containing negative constructions
// 2. Determine how to transform it into a positive statement that maintains the original meaning
// 3. Pay special attention to these patterns:
//    - "don't want to" → express what is wanted instead
//    - "can't" → express abilities or alternatives
//    - "never" → express frequency or difficulty
//    - "not" → express the opposite quality
// 4. Return ONLY the transformed sentence without any explanations

// EXAMPLES:
// - "I don't want to go" → "I want to stay home"
// - "I don't want to go to the movies" → "I want to go somewhere besides the movies"
// - "I don't care" → "I am indifferent"
// - "It will never work" → "It's going to be hard to make it work"
// - "I can't wait for tomorrow" → "I am looking forward to tomorrow"

// SENTENCE TO TRANSFORM:
// {text}

// TRANSFORMED SENTENCE:`;
//             break;
//     }
    
//     document.getElementById('addRulePrompt').value = defaultPrompt;
//     document.getElementById('addRuleModal').style.display = 'block';
// }

// /**
//  * Open the Edit Rule modal for a specific prompt
//  * @param {string} type - The prompt type (but, should, not)
//  * @param {string} name - The context name
//  * @param {object} contextData - The context data
//  */
// function openEditRuleModal(type, name, contextData) {
//     document.getElementById('editRuleType').value = type;
//     document.getElementById('editRuleName').value = name;
//     document.getElementById('editRuleDescription').value = contextData.description || '';
//     document.getElementById('editRulePrompt').value = contextData.prompt || '';
    
//     // Handle example data structure
//     if (contextData.example) {
//         if (typeof contextData.example === 'object' && contextData.example.from && contextData.example.to) {
//             document.getElementById('editRuleExampleFrom').value = contextData.example.from;
//             document.getElementById('editRuleExampleTo').value = contextData.example.to;
//         } else if (typeof contextData.example === 'string') {
//             const parts = contextData.example.split(' → ');
//             if (parts.length === 2) {
//                 document.getElementById('editRuleExampleFrom').value = parts[0].replace(/^"/, '').replace(/"$/, '');
//                 document.getElementById('editRuleExampleTo').value = parts[1].replace(/^"/, '').replace(/"$/, '');
//             } else {
//                 document.getElementById('editRuleExampleFrom').value = '';
//                 document.getElementById('editRuleExampleTo').value = contextData.example;
//             }
//         }
//     } else {
//         document.getElementById('editRuleExampleFrom').value = '';
//         document.getElementById('editRuleExampleTo').value = '';
//     }
    
//     document.getElementById('editTestContainer').style.display = 'none';
//     document.getElementById('editTestResult').style.display = 'none';
//     document.getElementById('editRuleModal').style.display = 'block';
// }

// /**
//  * Open the Test modal for a specific prompt
//  * @param {string} type - The prompt type (but, should, not)
//  * @param {string} name - The context name
//  * @param {object} contextData - The context data
//  */
// function openTestModal(type, name, contextData) {
//     // Reuse the edit modal for testing
//     openEditRuleModal(type, name, contextData);
    
//     // Show test section
//     showTestSection('edit');
//     document.getElementById('editTestText').focus();
// }

// /**
//  * Show the test section in the add or edit modal
//  * @param {string} mode - The mode ('add' or 'edit')
//  */
// function showTestSection(mode) {
//     document.getElementById(`${mode}TestContainer`).style.display = 'block';
//     document.getElementById(`${mode}TestResult`).style.display = 'none';
// }

// /**
//  * Test a prompt using the API
//  * @param {string} mode - The mode ('add' or 'edit')
//  */
// function testPrompt(mode) {
//     const testText = document.getElementById(`${mode}TestText`).value.trim();
//     if (!testText) {
//         alert('Please enter text to test.');
//         return;
//     }
    
//     const wordType = document.getElementById(`${mode}RuleType`).value;
//     const prompt = document.getElementById(`${mode}RulePrompt`).value;
    
//     // Display loading state
//     const testResult = document.getElementById(`${mode}TestResult`);
//     const testResultContent = document.getElementById(`${mode}TestResultContent`);
//     testResult.style.display = 'block';
//     testResultContent.innerHTML = '<div style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Processing with LLM...</div>';
    
//     // Call test endpoint
//     fetch('/test-prompt', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//             word_type: wordType,
//             prompt: prompt,
//             text: testText
//         })
//     })
//     .then(response => response.json())
//     .then(data => {
//         if (data.error) {
//             testResultContent.innerHTML = `<span style="color: red;">Error: ${data.error}</span>`;
//             return;
//         }
        
//         testResultContent.innerHTML = `
//             <div style="margin-bottom: 10px;"><strong>Original:</strong> ${escapeHtml(data.original)}</div>
//             <div><strong>Result:</strong> ${escapeHtml(data.result)}</div>
//         `;
//     })
//     .catch(error => {
//         console.error('Error testing prompt:', error);
//         testResultContent.innerHTML = '<span style="color: red;">An error occurred during testing.</span>';
//     });
// }

// /**
//  * View the full prompt content in a modal
//  * @param {string} promptText - The full prompt text
//  */
// function viewFullPrompt(promptText) {
//     document.getElementById('fullPromptContent').textContent = promptText;
//     document.getElementById('viewPromptModal').style.display = 'block';
// }

// /**
//  * Close a modal by ID
//  * @param {string} modalId - The ID of the modal to close
//  */
// function closeModal(modalId) {
//     document.getElementById(modalId).style.display = 'none';
// }

// /**
//  * Delete a prompt rule
//  * @param {string} type - The prompt type (but, should, not)
//  * @param {string} name - The context name
//  */
// function deleteRule(type, name) {
//     if (confirm(`Are you sure you want to delete the "${name}" prompt for ${formatTypeName(type)} translations?`)) {
//         fetch(`/prompts/${type}/${name}`, {
//             method: 'DELETE'
//         })
//         .then(response => response.json())
//         .then(result => {
//             if (result.success) {
//                 loadPrompts();
//             } else {
//                 alert(`Error: ${result.message || 'Failed to delete prompt'}`);
//             }
//         })
//         .catch(error => {
//             console.error('Error:', error);
//             alert('An error occurred while deleting the prompt.');
//         });
//     }
// }

// /**
//  * Format a type name for display
//  * @param {string} type - The type name
//  * @returns {string} - The formatted type name
//  */
// function formatTypeName(type) {
//     // Convert camelCase or snake_case to Title Case with spaces
//     return type
//         .replace(/_/g, ' ')
//         .replace(/([A-Z])/g, ' $1')
//         .replace(/^./, (str) => str.toUpperCase())
//         .trim();
// }

// /**
//  * Escape HTML special characters
//  * @param {string} str - String to escape
//  * @returns {string} - Escaped string
//  */
// function escapeHtml(str) {
//     if (!str) return '';
//     return str
//         .replace(/&/g, '&amp;')
//         .replace(/</g, '&lt;')
//         .replace(/>/g, '&gt;')
//         .replace(/"/g, '&quot;')
//         .replace(/'/g, '&#039;');
// }
// document.addEventListener('DOMContentLoaded', () => {
//     const slider = document.querySelector('.prompt-slider');
//     const prev   = document.querySelector('.prev-btn');
//     const next   = document.querySelector('.next-btn');
//     if (!slider) return;
  
//     // how far to scroll each click: 80% of visible width
//     const amount = slider.offsetWidth * 0.8;
  
//     prev.addEventListener('click', () => {
//       slider.scrollBy({ left: -amount, behavior: 'smooth' });
//     });
//     next.addEventListener('click', () => {
//       slider.scrollBy({ left:  amount, behavior: 'smooth' });
//     });
//   });
  