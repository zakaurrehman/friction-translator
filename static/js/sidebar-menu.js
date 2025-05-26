/**
 * Sidebar Menu - Handles the sidebar menu functionality
 * This module provides the JS functionality for the sidebar menu
 */

document.addEventListener('DOMContentLoaded', function() {
    const menuButton = document.getElementById('menuButton');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const overlay = document.getElementById('menuOverlay');
    const fileInput = document.getElementById('fileInput');
    const uploadFileBtn = document.getElementById('uploadFileBtn');
    const newDocumentBtn = document.getElementById('newDocumentBtn');
    const clearBtn = document.getElementById('clearBtn');
    const inputText = document.getElementById('inputText');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const editorSettingsBtn = document.getElementById('editorSettingsBtn');
    const getProBtn = document.getElementById('getProBtn');
    
    // Get download and print buttons from sidebar
    const sidebarPrintBtn = document.querySelector('.sidebar-item[id="printBtn"]');
    const sidebarDownloadBtn = document.querySelector('.sidebar-item[id="downloadBtn"]');
    
    // Open menu when clicking the menu button
    if (menuButton) {
        menuButton.addEventListener('click', function() {
            sidebarMenu.classList.add('active');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden'; // Prevent scrolling
        });
    }
    
    // Close menu when clicking the close button
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', function() {
            closeSidebar();
        });
    }
    
    // Close menu when clicking outside the menu
    if (overlay) {
        overlay.addEventListener('click', function() {
            closeSidebar();
        });
    }
    
    // Close menu when pressing Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && sidebarMenu && sidebarMenu.classList.contains('active')) {
            closeSidebar();
        }
    });
    
    // Upload file button in sidebar
    if (uploadFileBtn && fileInput) {
        uploadFileBtn.addEventListener('click', function() {
            fileInput.click();
            closeSidebar();
        });
    }
    
    // New document button in sidebar
    if (newDocumentBtn && clearBtn) {
        newDocumentBtn.addEventListener('click', function() {
            clearBtn.click();
            closeSidebar();
        });
    }
    
    // Undo button in sidebar
    if (undoBtn && inputText) {
        undoBtn.addEventListener('click', function() {
            document.execCommand('undo');
            inputText.focus();
            closeSidebar();
        });
    }
    
    // Redo button in sidebar
    if (redoBtn && inputText) {
        redoBtn.addEventListener('click', function() {
            document.execCommand('redo');
            inputText.focus();
            closeSidebar();
        });
    }
    
    // Select All button in sidebar
    if (selectAllBtn && inputText) {
        selectAllBtn.addEventListener('click', function() {
            // Close the sidebar first
            closeSidebar();
            // Wait for the sidebar to actually be hidden, then focus & select everything
            setTimeout(() => {
                inputText.focus();
                
                // Handle both contentEditable and textarea
                if (inputText.getAttribute('contenteditable') === 'true') {
                    // For contentEditable div
                    const range = document.createRange();
                    range.selectNodeContents(inputText);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    // For textarea
                    inputText.setSelectionRange(0, inputText.value.length);
                }
            }, 300);
        });
    }
    
    // Print button in sidebar - triggers input text printing
    if (sidebarPrintBtn && inputText) {
        sidebarPrintBtn.addEventListener('click', function() {
            closeSidebar();
            
            // Wait for sidebar to close, then print
            setTimeout(() => {
                printInputText();
            }, 300);
        });
    }
    
    // Download button in sidebar - triggers input text download
    if (sidebarDownloadBtn && inputText) {
        sidebarDownloadBtn.addEventListener('click', function() {
            closeSidebar();
            
            // Wait for sidebar to close, then download
            setTimeout(() => {
                downloadInputText();
            }, 300);
        });
    }
    
    // Function to print input text
    function printInputText() {
        const docTitle = document.getElementById('docTitle');
        
        // Get the input text HTML (handle both contentEditable and textarea)
        let content;
        if (inputText.getAttribute('contenteditable') === 'true') {
            content = inputText.innerHTML.trim();
        } else {
            // For textarea, convert line breaks to HTML
            content = inputText.value.trim().replace(/\n/g, '<br>');
        }
        
        if (!content) {
            createNotification('Print Error', 'Please enter some text before printing.');
            return;
        }

        // Get document title for the print window
        const title = docTitle ? docTitle.innerText.trim() : 'Document';

        // Open a new window for printing
        const win = window.open('', 'PrintWindow', 'width=700,height=500');
        win.document.write(`
            <html>
                <head>
                    <title>Print: ${title}</title>
                    <style>
                        /* Print-friendly styling */
                        body { 
                            margin: 2rem; 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            font-size: 12pt;
                            line-height: 1.6;
                            color: #333;
                        }
                        
                        h1 {
                            font-size: 16pt;
                            margin-bottom: 1rem;
                            color: #000;
                            border-bottom: 2px solid #333;
                            padding-bottom: 0.5rem;
                        }
                        
                        p { 
                            margin-bottom: 0.8em; 
                        }
                        
                        /* Remove any friction marks for clean printing */
                        .friction-mark {
                            border: none !important;
                            background: transparent !important;
                            color: inherit !important;
                        }
                        
                        /* Print-specific styles */
                        @media print {
                            body { margin: 1cm; }
                            h1 { page-break-after: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    <div class="content">
                        ${content}
                    </div>
                </body>
            </html>
        `);
        win.document.close();
        win.focus();
        
        // Add a small delay to ensure content is loaded before printing
        setTimeout(() => {
            win.print();
            win.close();
        }, 250);
        
        createNotification('Print', 'Print dialog opened successfully.');
    }
    
    // Function to download input text
    function downloadInputText() {
        const docTitle = document.getElementById('docTitle');
        const downloadForm = document.getElementById('downloadForm');
        const downloadInput = document.getElementById('downloadTextInput');
        const filenameInput = document.getElementById('downloadFilenameInput');

        // Get the input text (handle both contentEditable and textarea)
        const text = inputText.innerText ? inputText.innerText.trim() : inputText.value.trim();
        if (!text) {
            createNotification('Download Error', 'Please enter some text before downloading.');
            return;
        }

        if (!downloadForm || !downloadInput || !filenameInput) {
            createNotification('Download Error', 'Download form not found. Please refresh the page.');
            return;
        }

        // Grab the title from the header
        const rawName = docTitle ? docTitle.innerText.trim() : 'document';
        downloadInput.value = text;
        filenameInput.value = rawName || 'document';

        downloadForm.submit();
        createNotification('Download', 'Document download started successfully.');
    }
    
    // Editor Settings button
    if (editorSettingsBtn) {
        editorSettingsBtn.addEventListener('click', function() {
            // Create a notification for settings
            createNotification('Editor settings', 'Settings panel will be added in the next version.');
            closeSidebar();
        });
    }
    
    // Get Pro button
    if (getProBtn) {
        getProBtn.addEventListener('click', function() {
            createNotification('Pro Features', 'Pro features include advanced suggestions for wordiness, passive voice, and more sophisticated friction language detection.');
            closeSidebar();
        });
    }
    
    // Support button
    const supportBtn = document.getElementById('supportBtn');
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            createNotification('Support', 'Support panel will be added in the next version.');
            closeSidebar();
        });
    }

    // Documentation button
    const docsBtn = document.getElementById('docsBtn');
    if (docsBtn) {
        docsBtn.addEventListener('click', () => {
            createNotification('Documentation', 'Documentation section will be added in the next version.');
            closeSidebar();
        });
    }

    // Feedback button
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            createNotification('Feedback', 'Feedback form will be added in the next version.');
            closeSidebar();
        });
    }

    // Function to close the sidebar
    function closeSidebar() {
        if (sidebarMenu) sidebarMenu.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = ''; // Re-enable scrolling
    }
    
    // Function to create toast notifications
    function createNotification(title, message) {
        // Check if notification container exists, if not create it
        let notificationContainer = document.getElementById('notificationContainer');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.id = 'notificationContainer';
            notificationContainer.style.position = 'fixed';
            notificationContainer.style.bottom = '20px';
            notificationContainer.style.right = '20px';
            notificationContainer.style.zIndex = '9999';
            document.body.appendChild(notificationContainer);
        }
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.backgroundColor = 'var(--surface-1)';
        notification.style.borderLeft = '4px solid var(--primary-color)';
        notification.style.borderRadius = 'var(--radius-md)';
        notification.style.boxShadow = 'var(--shadow-md)';
        notification.style.padding = '12px 16px';
        notification.style.marginBottom = '10px';
        notification.style.minWidth = '300px';
        notification.style.maxWidth = '400px';
        notification.style.animation = 'notification-slide-in 0.3s ease-out forwards';
        
        // Create title
        const titleElement = document.createElement('div');
        titleElement.style.fontWeight = '600';
        titleElement.style.marginBottom = '5px';
        titleElement.style.color = 'var(--text-primary)';
        titleElement.textContent = title;
        
        // Create message
        const messageElement = document.createElement('div');
        messageElement.style.fontSize = '14px';
        messageElement.style.color = 'var(--text-secondary)';
        messageElement.textContent = message;
        
        // Create close button
        const closeButton = document.createElement('button');
        closeButton.style.position = 'absolute';
        closeButton.style.top = '8px';
        closeButton.style.right = '8px';
        closeButton.style.background = 'none';
        closeButton.style.border = 'none';
        closeButton.style.cursor = 'pointer';
        closeButton.style.fontSize = '14px';
        closeButton.style.color = 'var(--text-tertiary)';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', function() {
            notification.style.animation = 'notification-slide-out 0.3s ease-out forwards';
            setTimeout(() => {
                if (notification.parentNode) {
                    notificationContainer.removeChild(notification);
                }
            }, 300);
        });
        
        // Add elements to notification
        notification.appendChild(titleElement);
        notification.appendChild(messageElement);
        notification.appendChild(closeButton);
        
        // Set position
        notification.style.position = 'relative';
        
        // Add to container
        notificationContainer.appendChild(notification);
        
        // Add animation keyframes if they don't exist
        if (!document.getElementById('notificationStyles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'notificationStyles';
            styleSheet.innerHTML = `
                @keyframes notification-slide-in {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes notification-slide-out {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styleSheet);
        }
        
        // Auto-remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'notification-slide-out 0.3s ease-out forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notificationContainer.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
    
    // Update account info with simulated data
    updateAccountInfo();
});

// Function to update account info
function updateAccountInfo() {
    const userNameElement = document.querySelector('.account-name div:nth-child(2)');
    const userEmailElement = document.querySelector('.account-email');
    
    // Using demo data
    const userName = 'Demo User';
    const userEmail = 'demo@example.com';
    
    if (userNameElement) userNameElement.textContent = userName;
    if (userEmailElement) userEmailElement.textContent = userEmail;
}