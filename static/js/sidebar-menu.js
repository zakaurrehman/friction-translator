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
    const printBtn = document.getElementById('printBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const editorSettingsBtn = document.getElementById('editorSettingsBtn');
    const getProBtn = document.getElementById('getProBtn');
    
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
          // 1) close the sidebar first
          closeSidebar();
          // 2) wait for the sidebar to actually be hidden, then focus & select everything
          //    adjust the delay (300ms) to match your CSS transition length, or use 0/requestAnimationFrame
          setTimeout(() => {
            inputText.focus();
            inputText.setSelectionRange(0, inputText.value.length);
          }, 300);
        });
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
                notificationContainer.removeChild(notification);
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
