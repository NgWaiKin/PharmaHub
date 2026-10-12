// Global variable to store the selected language from localStorage ('user-language'), default is 'en'
window.currentLang = localStorage.getItem('user-language') || 'en';

// Main function to apply translation across the entire page
async function applyPageTranslation(targetLang) {

    if (window.currentLang === targetLang && document.body.getAttribute('data-translated') === targetLang) {
        return;
    }

    //Save selected language to localStorage
    window.currentLang = targetLang;
    localStorage.setItem('user-language', targetLang);
    document.body.setAttribute('data-translated', targetLang);

    //Select all DOM elements marked with data-translate attribute
    const elements = document.querySelectorAll('[data-translate]');

    for (let el of elements) {
        // Backup the original English text into data-original 
        if (!el.getAttribute('data-original')) {
            el.setAttribute('data-original', el.innerText.trim());
        }

        const originalText = el.getAttribute('data-original');
        if (!originalText) continue;

        // Show the original English text if target language is 'en' 
        if (targetLang === 'en') {
            el.innerText = originalText;
            continue;
        }

        try {
            await new Promise(r => setTimeout(r, 100));
            // Send the HTTP request to Express API Gateway route
            const response = await fetch(`/api/external/translate?text=${encodeURIComponent(originalText)}&targetLang=${targetLang}&_t=${Date.now()}`);
            const data = await response.json();

            if (data.success && data.translated_text) {
                if (data.translated_text.includes('<') && data.translated_text.includes('>')) {
                    console.warn('Ignored HTML Tag:', data.translated_text);
                    el.innerText = originalText;
                }
                else {
                    el.innerText = data.translated_text;
                }
            }
            else{
                // Fallback to original English text if API translation fails
                el.innerText = originalText;
            }
        } 
        catch (err){
            console.error(`Error translating "${originalText}":`, err);
            el.innerText = originalText; 
        }
    }

    // Update language switch buttons UI active state
    updateButtonUI(targetLang);
}

// Function to update active class on language selection buttons (.btn-language)
function updateButtonUI(currentLang) {
    const langButtons = document.querySelectorAll('.btn-language');
    langButtons.forEach(btn => {
        const btnLang = btn.getAttribute('data-language');
        if (btnLang === currentLang) {
            btn.classList.add('active');
        }
        else{
            btn.classList.remove('active');
        }
    });
}

// Automatically initialize event listeners and state when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Bind click events to all language buttons (.btn-language with data-language)
    const langButtons = document.querySelectorAll('.btn-language');
    langButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const selectedLang = btn.getAttribute('data-language');
            if (selectedLang) {
                applyPageTranslation(selectedLang);
            }
        });
    });

    // Auto-apply translation on page load if saved language is 'ms'
    if (window.currentLang && window.currentLang !== 'en') {
        applyPageTranslation(window.currentLang);
    } 
    else{
        updateButtonUI('en');
    }
});