// FocusLens Pro — Background Service Worker
// Content script'ten gelen çeviri isteklerini proxy olarak yapar
// CSP (Content Security Policy) kısıtlamalarını aşar

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'translate') {
        const { text, source, target } = request;
        // dt=t (translation), dt=bd (dictionary)
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                let translation = '';
                if (data[0] && data[0][0]) {
                    translation = data[0].map(x => x[0]).join(''); // For sentences split across multiple array items
                }

                let dict = null;
                // If dictionary array exists (data[1])
                if (data[1] && data[1].length > 0) {
                    dict = data[1].map(part => {
                        return {
                            pos: part[0], // Part of speech (noun, verb, etc.)
                            words: part[1].slice(0, 5).join(', ') // Top 5 common meanings
                        };
                    });
                }

                sendResponse({
                    success: true,
                    translation: translation || '—',
                    dictionary: dict
                });
            })
            .catch(err => {
                sendResponse({ success: false, error: err.message });
            });

        // true döndür — asenkron sendResponse için kanal açık kalmalı
        return true;
    }
});
