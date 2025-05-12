

document.addEventListener('DOMContentLoaded', function() {
    // Main elements
    const inputText = document.getElementById('inputText');
    const liveSuggestions = document.getElementById('liveSuggestions');
    const emptyAnalysis = document.getElementById('emptyAnalysis');
    const frictionWordsList = document.getElementById('frictionWordsList');
    const proSuggestions = document.getElementById('proSuggestions');
    const suggestionCount = document.getElementById('suggestionCount');
    const proSuggestionCount = document.getElementById('proSuggestionCount');
    const categoryTabs = document.querySelectorAll('.category-tab');

    // Pattern definitions for friction language detection
    // ... (unchanged definitions for frictionPatterns, otherPatterns) ...

    // Check the text for issues whenever the user types
    let debounceTimer;
    if (inputText) {
        inputText.addEventListener('input', function(event) {
            // Only run analysis on genuine user input, not programmatic updates
            if (!event.isTrusted) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const text = this.value.trim();
                if (text) {
                    analyzeText(text);
                    emptyAnalysis && (emptyAnalysis.style.display = 'none');
                    liveSuggestions && (liveSuggestions.style.display = 'block');
                } else {
                    emptyAnalysis && (emptyAnalysis.style.display = 'flex');
                    liveSuggestions && (liveSuggestions.style.display = 'none');
                }
            }, 500); // 500ms debounce
        });
    }

    // Category tab switching
    // ... (unchanged) ...

    function analyzeText(text) {
        // Clear previous suggestions
        frictionWordsList && (frictionWordsList.innerHTML = '');
        proSuggestions && (proSuggestions.innerHTML = '');
        // Collect suggestions lists
        const allSuggestions = [];
        const proSuggestionsList = [];

        // Friction language, capitalization, spelling, extra spaces, wordiness, passive voice checks
        // ... (unchanged logic to populate allSuggestions and proSuggestionsList) ...

        // Display and update counts
        displaySuggestions(allSuggestions, proSuggestionsList);
        updateSuggestionCounts(allSuggestions.length, proSuggestionsList.length);
    }

    // displaySuggestions, createSuggestionElement, getIconForCategory,
    // getContext, highlightTextIssue, applyCorrection,
    // getTextPosition, updateSuggestionCounts, filterSuggestionsByCategory,
    // getDefaultReplacement, escapeHtml
    // ... (unchanged utility functions) ...

});
