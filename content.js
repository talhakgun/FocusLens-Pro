let focusStyleTag = null;
let mainContentEl = null;
let markedAncestors = [];
let translationLang = { source: 'en', target: 'tr' };
let lastDblClickTime = 0;
let translateActive = true;

const DEFAULT_SETTINGS = {
    bgColor: "#1a1b2e",
    maxWidth: "1100",
    tagSettings: {}
};

function findMainContent() {
    let root = document.querySelector('article') || document.querySelector('[role="main"]') || document.querySelector('main');
    
    if (!root) {
        const selectors = ['.post-content', '.article-content', '.entry-content', '.content-body', '.article-body', '.story-body', '.post-body', '#content', '#main-content', '.main-content', '.page-content', '.blog-post', '.single-post'];
        for (const s of selectors) { 
            const el = document.querySelector(s); 
            if (el && (el.textContent || '').trim().length > 200) {
                root = el;
                break;
            }
        }
    }
    
    if (!root) root = document.body;

    let totalText = (root.textContent || '').replace(/\s+/g, '').length;
    if (totalText < 200) return root;

    let current = root;
    let foundDeeper = true;

    while (foundDeeper) {
        foundDeeper = false;
        let children = Array.from(current.children).filter(c => !['NAV', 'HEADER', 'FOOTER', 'ASIDE', 'SCRIPT', 'STYLE'].includes(c.tagName));
        
        // Eğer birden fazla çocukta anlamlı miktarda text varsa (akordeon maddeleri gibi), dur.
        let significantChildren = children.filter(c => (c.textContent || '').replace(/\s+/g, '').length > totalText * 0.15);
        if (significantChildren.length > 1) break;

        for (let child of children) {
            let childText = (child.textContent || '').replace(/\s+/g, '').length;
            if (childText > totalText * 0.80) { // Eşiği %80'e çıkardım
                current = child;
                foundDeeper = true;
                break;
            }
        }
    }
    
    return current;
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === "liveUpdate") {
        if (req.data.sourceLang) translationLang.source = req.data.sourceLang;
        if (req.data.targetLang) translationLang.target = req.data.targetLang;
        if (req.data.translateActive !== undefined) translateActive = req.data.translateActive;
        applyStyles(req.data);
    } else if (req.action === "getTags") {
        const main = mainContentEl || findMainContent();
        const textTags = new Set();
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim().length > 0) {
                const tag = node.parentElement.tagName.toLowerCase();
                if (!['script','style','noscript','svg','path','img','button'].includes(tag)) {
                    textTags.add(tag);
                }
            }
        }
        const tags = Array.from(textTags).slice(0, 20);
        sendResponse({ tags });
    } else if (req.action === "getState") {
        const isActive = document.documentElement.classList.contains('fl-active');
        sendResponse({ isActive: isActive, translateActive: translateActive });
    }
    return true;
});

chrome.storage.local.get(null, data => {
    if (data.sourceLang) translationLang.source = data.sourceLang;
    if (data.targetLang) translationLang.target = data.targetLang;
    if (data.translateActive !== undefined) translateActive = data.translateActive;
    if (data.focusActive) {
        applyStyles(Object.keys(data).length > 1 ? data : { ...DEFAULT_SETTINGS, focusActive: true });
    }
});

function applyStyles(data) {
    if (!data.focusActive) { deactivateFocus(); return; }
    if (!mainContentEl) activateFocus();
    updateDynamicStyles(data);
}

function activateFocus() {
    mainContentEl = findMainContent();
    mainContentEl.classList.add('fl-main');
    let el = mainContentEl.parentElement;
    while (el && el !== document.documentElement) {
        el.classList.add('fl-ancestor');
        markedAncestors.push(el);
        el = el.parentElement;
    }
    document.documentElement.classList.add('fl-active');
    document.body.classList.add('fl-active');
    focusStyleTag = document.createElement('style');
    focusStyleTag.id = 'focus-lens-styles';
    document.head.appendChild(focusStyleTag);

    // Tag label'ları sadece içi dolu elementlere ekle (max 300)
    const tagEls = mainContentEl.querySelectorAll('p,h1,h2,h3,li,a,span');
    const tagLimit = Math.min(tagEls.length, 300);
    for (let i = 0; i < tagLimit; i++) {
        if ((tagEls[i].textContent || '').trim().length > 0) {
            tagEls[i].setAttribute('data-tag-label', tagEls[i].tagName);
        }
    }
}

function deactivateFocus() {
    if (mainContentEl) {
        mainContentEl.classList.remove('fl-main');
        mainContentEl.querySelectorAll('[data-tag-label]').forEach(e => e.removeAttribute('data-tag-label'));
        mainContentEl = null;
    }
    markedAncestors.forEach(e => e.classList.remove('fl-ancestor'));
    markedAncestors = [];
    document.documentElement.classList.remove('fl-active');
    document.body.classList.remove('fl-active');
    if (focusStyleTag) { focusStyleTag.remove(); focusStyleTag = null; }
}

function updateDynamicStyles(data) {
    if (!focusStyleTag) return;
    
    // Sayfadaki text taglerini bul
    const textTags = new Set();
    if (mainContentEl) {
        const walker = document.createTreeWalker(mainContentEl, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            if (node.nodeValue.trim().length > 0) {
                const tag = node.parentElement.tagName.toLowerCase();
                if (!['script','style','noscript','svg','path','img','button'].includes(tag)) {
                    textTags.add(tag);
                }
            }
        }
    }
    
    let tagCSS = '';
    const settings = data.tagSettings || {};
    
    textTags.forEach(tag => {
        let s = settings[tag];
        if (!s) {
            // Dinamik tagler için varsayılanlar
            if (tag === 'h1') s = { fontSize: 34, lineHeight: 1.3, fontColor: '#e8eaed' };
            else if (tag === 'h2') s = { fontSize: 26, lineHeight: 1.4, fontColor: '#e0e2e8' };
            else if (tag === 'h3') s = { fontSize: 21, lineHeight: 1.5, fontColor: '#c0c4ce' };
            else s = { fontSize: 18, lineHeight: 1.9, fontColor: '#d0d3dc' };
        }
        tagCSS += `.fl-main ${tag}{font-size:${s.fontSize}px!important;line-height:${s.lineHeight}!important;color:${s.fontColor}!important;}`;
    });
    focusStyleTag.textContent = `
html.fl-active, body.fl-active{background:${data.bgColor}!important;overflow-x:hidden!important;}
html.fl-active>*:not(body){display:none!important;}
body.fl-active>*:not(.fl-ancestor):not(.fl-main):not(#focus-lens-translate-popup):not(style):not(script):not(link){display:none!important;}
.fl-active .fl-ancestor>*:not(.fl-ancestor):not(.fl-main):not(#focus-lens-translate-popup):not(style):not(script){display:none!important;}
#focus-lens-translate-popup{display:block!important;visibility:visible!important;opacity:1!important;}
body.fl-active .fl-ancestor{display:block!important;visibility:visible!important;width:100%!important;max-width:100%!important;padding:0!important;margin:0 auto!important;background:transparent!important;border:none!important;box-shadow:none!important;float:none!important;position:static!important;transform:none!important;opacity:1!important;overflow:visible!important;}
.fl-main{display:block!important;visibility:visible!important;max-width:${data.maxWidth}px!important;width:100%!important;background:transparent!important;padding:60px 60px!important;margin:40px auto!important;box-shadow:none!important;box-sizing:border-box!important;min-height:80vh!important;font-family:'Segoe UI',system-ui,-apple-system,sans-serif!important;overflow-wrap:break-word!important;position:relative!important;}
.fl-main *{box-sizing:border-box!important;}

/* 
   GLOBAL SPECIFICITY NUKE
   Artık sadece .fl-main'i değil, sayfadaki tüm elemanları (body.fl-active *) 
   devasa bir baskınlıkla şeffaf yapıyoruz. Bu sayede akordeon başlıkları 
   ancestor (ata) olsa bile beyaz kalamaz.
*/
body.fl-active *:not(#focus-lens-translate-popup):not(#focus-lens-translate-popup *):not(.n1):not(.n2):not(.n3):not(.n4):not(.n5):not(.n6):not(.n7):not(.n8):not(.n9):not(.n10):not(.n11):not(.n12):not(.n13):not(.n14):not(.n15):not(.n16):not(.n17):not(.n18):not(.n19):not(.n20),
body.fl-active *:not(#focus-lens-translate-popup):not(#focus-lens-translate-popup *):not(.n1):not(.n2):not(.n3):not(.n4):not(.n5):not(.n6):not(.n7):not(.n8):not(.n9):not(.n10):not(.n11):not(.n12):not(.n13):not(.n14):not(.n15):not(.n16):not(.n17):not(.n18):not(.n19):not(.n20)::before,
body.fl-active *:not(#focus-lens-translate-popup):not(#focus-lens-translate-popup *):not(.n1):not(.n2):not(.n3):not(.n4):not(.n5):not(.n6):not(.n7):not(.n8):not(.n9):not(.n10):not(.n11):not(.n12):not(.n13):not(.n14):not(.n15):not(.n16):not(.n17):not(.n18):not(.n19):not(.n20)::after {
    background: transparent !important;
    background-color: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    text-shadow: none !important;
    filter: none !important;
    backdrop-filter: none !important;
    outline: none !important;
    transition: none !important;
}

/* Modern & Premium Etkileşimli Elemanlar */
.fl-main table, 
.fl-main [class*="card"], 
.fl-main [class*="accordion"], 
.fl-main [class*="panel"],
.fl-main details {
    border: 1px solid rgba(255,255,255,0.08) !important;
    border-radius: 12px !important;
    padding: 2px 4px !important;
    margin: 1.2em 0 !important;
    background: rgba(255,255,255,0.03) !important;
    backdrop-filter: blur(8px) !important;
    display: block !important;
    width: 100% !important;
    transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease !important;
}

.fl-main [class*="card"]:hover, .fl-main [class*="accordion"]:hover {
    border-color: rgba(255,255,255,0.15) !important;
    background: rgba(255,255,255,0.05) !important;
}

/* Buton Tasarımı (Bağımsız Linkler ve Butonlar) */
.fl-main button, 
.fl-main .btn, 
.fl-main [role="button"],
.fl-main a:not(p a):not(li a):not(span a):not(h1 a):not(h2 a):not(h3 a) {
    background: rgba(255,255,255,0.06) !important;
    border: 1px solid rgba(255,255,255,0.12) !important;
    border-radius: 8px !important;
    padding: 8px 16px !important;
    color: #e8eaed !important;
    cursor: pointer !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    text-decoration: none !important;
    font-weight: 500 !important;
    transition: all 0.2s ease !important;
    margin: 6px 4px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
}

.fl-main button:hover, .fl-main .btn:hover, .fl-main a:not(p a):hover {
    background: rgba(255,255,255,0.1) !important;
    border-color: rgba(255,255,255,0.2) !important;
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 16px rgba(0,0,0,0.25) !important;
}

/* İçerik İçi Linkler (Nazik Düzenleme) */
.fl-main p a, .fl-main li a, .fl-main span a, .fl-main h1 a, .fl-main h2 a, .fl-main h3 a {
    color: #58a6ff !important;
    text-decoration: underline !important;
    text-underline-offset: 3px !important;
    text-decoration-color: rgba(88, 166, 255, 0.3) !important;
    background: transparent !important;
    border: none !important;
    padding: 0 !important;
    margin: 0 !important;
    font-weight: 500 !important;
    transition: text-decoration-color 0.2s ease !important;
}

.fl-main p a:hover, .fl-main li a:hover {
    text-decoration-color: #58a6ff !important;
}

.fl-main svg, .fl-main svg * {
    fill: currentColor !important;
    stroke: currentColor !important;
}

html.fl-active body.fl-active .fl-main input, 
html.fl-active body.fl-active .fl-main select, 
html.fl-active body.fl-active .fl-main textarea {
    border: 1px solid rgba(255,255,255,0.2) !important;
    background: rgba(255,255,255,0.03) !important;
    border-radius: 6px !important;
    padding: 6px 10px !important;
    color: inherit !important;
}
}

.fl-main p, .fl-main h1, .fl-main h2, .fl-main h3, .fl-main h4, .fl-main h5, .fl-main h6, .fl-main span, .fl-main a, .fl-main li {opacity:1!important; visibility:visible!important;}
.fl-main nav,.fl-main>header,.fl-main>footer,.fl-main aside,.fl-main .sidebar,.fl-main .ad,.fl-main .ads,.fl-main .advertisement,.fl-main .social-share,.fl-main .related-posts,.fl-main .comments,.fl-main [role="navigation"],.fl-main [role="complementary"],.fl-main [role="contentinfo"]{display:none!important;}
.fl-main img{max-height:75vh!important;object-fit:contain!important;margin:30px auto!important;display:block!important;border-radius:8px!important;}
.fl-main p,.fl-main h1,.fl-main h2,.fl-main h3{margin-bottom:1.4em!important;}
.fl-main ul{list-style-type:disc!important;padding-left:2.5em!important;margin-bottom:1.5em!important;}
.fl-main ol{list-style-type:decimal!important;padding-left:2.5em!important;margin-bottom:1.5em!important;}
.fl-main li{margin-bottom:0.5em!important;}
.fl-main table{width:100%!important;border-collapse:collapse!important;margin-bottom:2em!important;font-size:0.95em!important;}
.fl-main th,.fl-main td{border:1px solid rgba(255,255,255,0.1)!important;padding:12px 16px!important;text-align:left!important;vertical-align:top!important;}
.fl-main th{background:rgba(255,255,255,0.05)!important;font-weight:600!important;}
.fl-main blockquote{border-left:4px solid rgba(255,255,255,0.2)!important;padding-left:18px!important;margin:1.5em 0!important;font-style:italic!important;opacity:0.85!important;}
.fl-main pre{background:rgba(0,0,0,0.2)!important;padding:16px!important;border-radius:8px!important;overflow-x:auto!important;margin-bottom:1.5em!important;}
.fl-main code{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important;font-size:0.85em!important;background:rgba(0,0,0,0.2)!important;padding:3px 6px!important;border-radius:4px!important;}
.fl-main pre code{background:transparent!important;padding:0!important;font-size:0.9em!important;}
.fl-main hr{border:0!important;height:1px!important;background:rgba(255,255,255,0.1)!important;margin:2.5em 0!important;}
.fl-main br{display:none!important;}
${tagCSS}`;
}


// ===========================
// ÇEVİRİ ÖZELLİĞİ
// ===========================

function getSentenceAround(node, wordOrPhrase) {
    if (!node) return null;
    let block = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const blockTags = ['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SE', 'ARTICLE', 'SECTION'];
    while (block && block.parentElement && !blockTags.includes(block.tagName.toUpperCase())) {
        block = block.parentElement;
    }
    if (!block) return null;

    const fullText = (block.textContent || '').replace(/\s+/g, ' ');
    if (!fullText) return null;

    const idx = fullText.toLowerCase().indexOf((wordOrPhrase || '').toLowerCase());
    if (idx === -1) return null;

    const brk = /[.!?;。！？；]/;
    let start = 0, end = fullText.length;
    for (let i = idx - 1; i >= 0; i--) {
        if (brk.test(fullText[i])) { start = i + 1; break; }
    }
    for (let i = idx + (wordOrPhrase || '').length; i < fullText.length; i++) {
        if (brk.test(fullText[i])) { end = i + 1; break; }
    }
    const s = fullText.substring(start, end).trim();
    return s.length > 5 ? s : null;
}

function closeTranslatePopup() {
    const p = document.getElementById('focus-lens-translate-popup');
    if (p) p.remove();
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

async function fetchTranslation(word, sentence, popup) {
    const src = translationLang.source, tgt = translationLang.target;
    try {
        const wordResult = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'translate', text: word, source: src, target: tgt },
                response => {
                    if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                    else resolve(response);
                }
            );
        });
        const translation = wordResult.success ? wordResult.translation : '—';
        const dictionary = wordResult.success && wordResult.dictionary ? wordResult.dictionary : null;

        // Cümle çevirisi
        let exOrig = sentence, exTrans = '';
        if (sentence && sentence.length > word.length + 5 && sentence.length < 300) {
            const sentResult = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    { action: 'translate', text: sentence, source: src, target: tgt },
                    response => {
                        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                        else resolve(response);
                    }
                );
            });
            exTrans = sentResult.success ? sentResult.translation : '';
        }

        let dictHtml = '';
        if (dictionary && dictionary.length > 0) {
            dictHtml = '<div class="fl-translate-divider"></div><div class="fl-dict-container">';
            dictionary.forEach(d => {
                dictHtml += `<div class="fl-dict-item"><span class="fl-dict-pos">${escapeHtml(d.pos)}</span><div class="fl-dict-words">${escapeHtml(d.words)}</div></div>`;
            });
            dictHtml += '</div>';
        }

        popup.innerHTML = `<div class="fl-translate-header"><span class="fl-translate-word">${escapeHtml(word)}</span><button class="fl-translate-close" id="flTranslateClose">✕</button></div><div class="fl-translate-result">${escapeHtml(translation)}</div>${dictHtml}${exTrans ? `<div class="fl-translate-divider"></div><div class="fl-translate-example-label">Örnek Cümle:</div><div class="fl-translate-example-original">"${escapeHtml(exOrig)}"</div><div class="fl-translate-example-translated">"${escapeHtml(exTrans)}"</div>` : ''}`;
        document.getElementById('flTranslateClose').onclick = e => { e.stopPropagation(); closeTranslatePopup(); };
        requestAnimationFrame(() => {
            const r = popup.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
            if (r.right > vw - 10) popup.style.left = Math.max(10, vw - r.width - 10) + 'px';
            if (r.bottom > vh - 10) popup.style.top = (parseFloat(popup.style.top) - r.height - 40) + 'px';
        });
    } catch (e) {
        popup.innerHTML = `<div class="fl-translate-header"><span class="fl-translate-word">${escapeHtml(word)}</span><button class="fl-translate-close" id="flTranslateClose">✕</button></div><div class="fl-translate-error">Çeviri yapılamadı.</div>`;
        document.getElementById('flTranslateClose').onclick = e => { e.stopPropagation(); closeTranslatePopup(); };
    }
}

// Kelime karakteri kontrolü
function isWordChar(c) {
    return !/[\s.,!?;:"'()\[\]{}“”‘’]/.test(c);
}

// SAĞ TIKLAMA (CONTEXT MENU) İLE ÇEVİRİ
window.addEventListener('contextmenu', e => {
    if (!translateActive) return;

    if (e.target && e.target.closest && e.target.closest('#focus-lens-translate-popup')) return;

    let word = "";
    let sentence = "";
    let rect = { left: e.clientX, bottom: e.clientY };
    let anchorNode = null;

    const sel = window.getSelection();

    // 1. ÖNCELİK: Eğer kullanıcı zaten bir metin/cümle seçmişse (ve farenin altındaki metin bu seçimin bir parçasıysa), onu al
    if (sel && sel.toString().trim().length > 1) {
        word = sel.toString().trim();
        anchorNode = sel.anchorNode;
        if (sel.rangeCount > 0) rect = sel.getRangeAt(0).getBoundingClientRect();
    }
    // 2. ÖNCELİK: Seçim yoksa, farenin altındaki kelimeyi bul (CaretRangeFromPoint ile)
    else {
        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        }

        if (range && range.startContainer.nodeType === Node.TEXT_NODE) {
            const textNode = range.startContainer;
            const text = textNode.textContent;
            let start = range.startOffset;
            let end = range.startOffset;

            // Kelimenin sınırlarını bul
            while (start > 0 && isWordChar(text[start - 1])) start--;
            while (end < text.length && isWordChar(text[end])) end++;

            if (start < end) {
                word = text.substring(start, end).trim();
                anchorNode = textNode;

                // Seçimi ekranda göster
                sel.removeAllRanges();
                const newRange = document.createRange();
                newRange.setStart(textNode, start);
                newRange.setEnd(textNode, end);
                sel.addRange(newRange);

                rect = newRange.getBoundingClientRect();
            }
        }
    }

    if (!word || word.length < 2) return;

    sentence = getSentenceAround(anchorNode, word);

    // Tarayıcının varsayılan sağ tık menüsünü ve sitenin eventlerini ENGELLER
    e.preventDefault();
    e.stopImmediatePropagation();
    e.stopPropagation();

    closeTranslatePopup();

    try {
        const popup = document.createElement('div');
        popup.id = 'focus-lens-translate-popup';
        popup.innerHTML = '<div class="fl-translate-loading"><div class="fl-translate-spinner"></div>Çevriliyor...</div>';
        popup.setAttribute('style', [
            'position: fixed !important',
            'left: ' + rect.left + 'px !important',
            'top: ' + (rect.bottom + 8) + 'px !important',
            'z-index: 2147483647 !important',
            'display: block !important',
            'visibility: visible !important',
            'opacity: 1 !important',
            'pointer-events: auto !important',
            'background: #ffffff !important',
            'border: 1px solid #e0e0e0 !important',
            'border-radius: 12px !important',
            'box-shadow: 0 8px 32px rgba(0,0,0,0.18) !important',
            'padding: 16px 18px !important',
            'min-width: 240px !important',
            'max-width: 380px !important',
            'font-family: Segoe UI, system-ui, sans-serif !important'
        ].join('; '));

        document.body.appendChild(popup);
        fetchTranslation(word, sentence, popup);
    } catch (err) {
        console.error("FocusLens Çeviri Hatası:", err);
    }
}, true);

document.addEventListener('selectionchange', e => {
    if (!translateActive) return;
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
        e.stopPropagation();
    }
}, true);

window.addEventListener('click', e => {
    if (!translateActive) return;

    // Popup kapatma mantığı
    const popup = document.getElementById('focus-lens-translate-popup');
    if (popup && (!e.target || !e.target.closest || !e.target.closest('#focus-lens-translate-popup'))) {
        closeTranslatePopup();
    }
}, true);

window.addEventListener('keydown', e => { if (e.key === 'Escape') closeTranslatePopup(); }, true);