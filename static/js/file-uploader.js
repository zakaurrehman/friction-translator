/**
 * Consolidated File Upload Handler for Friction Language Translator
 * This script handles file uploads and processes files with the server
 */

document.addEventListener('DOMContentLoaded', function() {
    // Get references to the DOM elements
    const fileInput = document.getElementById('fileInput');
    const uploadBtns = document.querySelectorAll('.file-upload-btn, #uploadFileBtn');
    const uploadDocumentBtn = document.querySelector('button[title="Upload a document"]');
    const inputText = document.getElementById('inputText');
    const docTitle = document.getElementById('docTitle');
    const emptyState = document.querySelector('.empty-state');
    const translateBtn = document.getElementById('translateBtn');
    
    // First, remove any existing event listeners on the file input
    // to prevent conflicts with other scripts
    if (fileInput) {
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // Reassign the fileInput reference to the new element
        const fileInput = newFileInput;
        
        // Add our event listener to the new file input
        fileInput.addEventListener('change', handleFileUpload);
    }
    
    // Add click handlers to all upload buttons
    uploadBtns.forEach(btn => {
        // Remove any existing click listeners
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        // Add our click handler
        newBtn.addEventListener('click', function() {
            fileInput.click();
        });
    });
    
    // Add click handler to the "Upload a document" button in the page content
    if (uploadDocumentBtn) {
        // Remove any existing click listeners
        const newUploadDocumentBtn = uploadDocumentBtn.cloneNode(true);
        uploadDocumentBtn.parentNode.replaceChild(newUploadDocumentBtn, uploadDocumentBtn);
        
        // Add our click handler
        newUploadDocumentBtn.addEventListener('click', function() {
            fileInput.click();
        });
    }
    
    // Handle file upload
    function handleFileUpload(event) {
        console.log("File change event triggered");
        const file = event.target.files[0];
        if (!file) return;
        
        // Check file extension
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const validExtensions = ['.txt', '.pdf', '.doc', '.docx'];
        
        if (!validExtensions.includes(fileExtension)) {
            showNotification('Please upload only .txt, .pdf, .doc, or .docx files.', 'error');
            return;
        }
        
        // Update document title
        if (docTitle) {
            docTitle.textContent = `Content extracted from ${file.name}...`;
        }
        
        // Show loading state
        showLoadingIndicator(`Processing ${file.name}...`);
        
        // Hide empty state
        if (emptyState) {
            emptyState.style.display = 'none';
        }
        
        // Process the file based on its type
        if (fileExtension === '.txt') {
            // Process text files directly in the browser
            processTextFile(file);
        } else {
            // For PDF and Word docs, send to the server
            uploadToServer(file);
        }
    }
    
    // Process text files directly in the browser
    function processTextFile(file) {
        console.log("Processing text file:", file.name);
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            updateEditorContent(content);
            
            // Update document title
            if (docTitle) {
                docTitle.textContent = `Content extracted from ${file.name}`;
            }
            
            showNotification(`Text file "${file.name}" processed successfully!`, 'success');
        };
        
        reader.onerror = function(e) {
            console.error('Error reading text file:', e);
            showNotification('Error reading text file. Please try again.', 'error');
            resetEditor();
        };
        
        reader.readAsText(file);
    }
    
    // Upload file to server for processing
    function uploadToServer(file) {
        console.log("Uploading to server:", file.name);
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Send to server
        fetch('/process-document', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success && data.text) {
                // Update the editor with the extracted text
                updateEditorContent(data.text);
                
                // Update document title
                if (docTitle) {
                    docTitle.textContent = `Content extracted from ${file.name}`;
                }
                
                showNotification(`File "${file.name}" processed successfully!`, 'success');
            } else {
                throw new Error(data.error || 'No text could be extracted from the document.');
            }
        })
        .catch(error => {
            console.error('Error processing file on server:', error);
            showNotification(`Error: ${error.message}`, 'error');
            
            // If server processing fails, don't show simulated content
            // This ensures we don't replace actual content that might have been shown
            resetEditor();
        });
    }
    
    // Show loading indicator in the editor
    function showLoadingIndicator(message) {
        if (!inputText) return;
        
        if (inputText.tagName === 'DIV' && inputText.getAttribute('contenteditable') === 'true') {
            // For contentEditable
            inputText.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 24px; color: #5f6be0; margin-bottom: 15px;"></i>
                    <div style="font-size: 16px; color: #666;">${message}</div>
                </div>
            `;
        } else {
            // For textarea
            inputText.value = message;
        }
    }
    
    // Update editor content
    function updateEditorContent(content) {
        if (!inputText) return;
        
        // For debugging
        console.log("Updating editor with content length:", content.length);
        
        if (inputText.tagName === 'DIV' && inputText.getAttribute('contenteditable') === 'true') {
            // For contentEditable divs
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
        
        // Trigger input event to analyze the content
        const inputEvent = new Event('input', { bubbles: true });
        inputText.dispatchEvent(inputEvent);
    }
    
    // Reset editor to empty state
    function resetEditor() {
        if (!inputText) return;
        
        if (inputText.tagName === 'DIV' && inputText.getAttribute('contenteditable') === 'true') {
            inputText.innerHTML = '';
        } else {
            inputText.value = '';
        }
        
        // Show empty state if it exists
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
    }
    
    // Show notification toast
    function showNotification(message, type = 'info') {
        // Check if notification container exists, if not create it
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.style.position = 'fixed';
            container.style.bottom = '20px';
            container.style.right = '20px';
            container.style.zIndex = '9999';
            document.body.appendChild(container);
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.backgroundColor = '#ffffff';
        notification.style.boxShadow = '0 3px 10px rgba(0,0,0,0.1)';
        notification.style.borderRadius = '8px';
        notification.style.padding = '12px 20px';
        notification.style.marginBottom = '10px';
        notification.style.display = 'flex';
        notification.style.alignItems = 'center';
        notification.style.width = '320px';
        notification.style.animation = 'fadeInRight 0.3s forwards';
        
        // Set color based on type
        let color;
        let icon;
        switch (type) {
            case 'error':
                color = '#fd7e55';
                icon = 'fa-exclamation-circle';
                break;
            case 'warning':
                color = '#f0ad4e';
                icon = 'fa-exclamation-triangle';
                break;
            case 'success':
            default:
                color = '#5f6be0';
                icon = 'fa-check-circle';
        }
        notification.style.borderLeft = `4px solid ${color}`;
        
        // Set inner HTML content
        notification.innerHTML = `
            <i class="fas ${icon}" style="color: ${color}; margin-right: 12px; font-size: 18px;"></i>
            <div style="flex: 1;">
                <div style="font-weight: 500; margin-bottom: 2px; color: #333;">
                    ${type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Success')}
                </div>
                <div style="font-size: 14px; color: #666;">${message}</div>
            </div>
            <button style="background: none; border: none; color: #999; cursor: pointer; font-size: 18px; padding: 0 0 0 10px;">&times;</button>
        `;
        
        // Add click handler to close button
        const closeBtn = notification.querySelector('button');
        closeBtn.addEventListener('click', function() {
            notification.style.animation = 'fadeOutRight 0.3s forwards';
            setTimeout(function() {
                if (notification.parentNode) {
                    container.removeChild(notification);
                }
            }, 300);
        });
        
        // Add notification to container
        container.appendChild(notification);
        
        // Add animation styles if not already added
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes fadeInRight {
                    from { opacity: 0; transform: translateX(100px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes fadeOutRight {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(100px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(function() {
            if (notification.parentNode) {
                notification.style.animation = 'fadeOutRight 0.3s forwards';
                setTimeout(function() {
                    if (notification.parentNode) {
                        container.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
    
    // Log that this script has been loaded
    console.log("Consolidated file upload handler initialized");
});