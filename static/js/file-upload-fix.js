/**
 * Simple File Upload Fix
 * This fixes the issue of the simulated content replacing real content
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get file input element
    const fileInput = document.getElementById('fileInput');
    
    if (fileInput) {
        // Save the original change handler
        const originalOnChange = fileInput.onchange;
        
        // Set our fixed handler
        fileInput.onchange = function(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            // Only process .txt files directly
            if (file.name.toLowerCase().endsWith('.txt')) {
                // Process text file in the browser
                const reader = new FileReader();
                
                reader.onload = function(e) {
                    const content = e.target.result;
                    
                    // Update document title
                    const docTitle = document.getElementById('docTitle');
                    if (docTitle) {
                        docTitle.textContent = `Content extracted from ${file.name}`;
                    }
                    
                    // Update the editor content
                    const inputText = document.getElementById('inputText');
                    if (inputText) {
                        if (inputText.getAttribute('contenteditable') === 'true') {
                            // For contentEditable div
                            const safeContent = content
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/\n/g, '<br>');
                            
                            inputText.innerHTML = safeContent;
                        } else {
                            // For textarea
                            inputText.value = content;
                        }
                        
                        // Trigger input event
                        const inputEvent = new Event('input', { bubbles: true });
                        inputText.dispatchEvent(inputEvent);
                    }
                    
                    // Hide empty state
                    const emptyState = document.querySelector('.empty-state');
                    if (emptyState) {
                        emptyState.style.display = 'none';
                    }
                };
                
                reader.readAsText(file);
                
                // Prevent other handlers from running
                event.stopImmediatePropagation();
                return false;
            }
            
            // For other file types, send to server
            if (file.name.toLowerCase().endsWith('.pdf') || 
                file.name.toLowerCase().endsWith('.doc') || 
                file.name.toLowerCase().endsWith('.docx')) {
                
                // Create loading indicator
                const inputText = document.getElementById('inputText');
                if (inputText) {
                    if (inputText.getAttribute('contenteditable') === 'true') {
                        inputText.innerHTML = `
                            <div style="text-align: center; padding: 40px;">
                                <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #5f6be0; margin-bottom: 15px;"></i>
                                <div style="font-size: 16px; color: #666;">Processing ${file.name}...</div>
                            </div>
                        `;
                    } else {
                        inputText.value = `Processing ${file.name}...`;
                    }
                }
                
                // Update document title
                const docTitle = document.getElementById('docTitle');
                if (docTitle) {
                    docTitle.textContent = `Content extracted from ${file.name}...`;
                }
                
                // Hide empty state
                const emptyState = document.querySelector('.empty-state');
                if (emptyState) {
                    emptyState.style.display = 'none';
                }
                
                // Create form data
                const formData = new FormData();
                formData.append('file', file);
                
                // Send to server
                fetch('/process-document', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success && data.text) {
                        // Set the content
                        if (inputText) {
                            if (inputText.getAttribute('contenteditable') === 'true') {
                                // For contentEditable div
                                const safeContent = data.text
                                    .replace(/&/g, '&amp;')
                                    .replace(/</g, '&lt;')
                                    .replace(/>/g, '&gt;')
                                    .replace(/\n/g, '<br>');
                                
                                inputText.innerHTML = safeContent;
                            } else {
                                // For textarea
                                inputText.value = data.text;
                            }
                            
                            // Trigger input event
                            const inputEvent = new Event('input', { bubbles: true });
                            inputText.dispatchEvent(inputEvent);
                        }
                        
                        // Update document title
                        if (docTitle) {
                            docTitle.textContent = `Content extracted from ${file.name}`;
                        }
                    } else {
                        alert('Error processing file: ' + (data.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Error processing file. Please try again.');
                });
                
                // Prevent other handlers from running
                event.stopImmediatePropagation();
                return false;
            }
            
            // If it's not a file type we handle, let other handlers take over
            if (typeof originalOnChange === 'function') {
                return originalOnChange.call(this, event);
            }
        };
    }
    
    console.log('Simple file upload fix applied');
});