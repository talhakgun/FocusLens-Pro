let selectedTag = null;
let tagSettings = {};

// Modern varsayılan ayarlar — hafızada sabit tutuluyor
const DEFAULTS = {
    focusActive: false,
    bgColor: '#1a1b2e',
    maxWidth: '1100',
    sourceLang: 'en',
    targetLang: 'tr',
    translateActive: true,
    tagSettings: {}
};

async function analyzeTags() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { action: "getTags" }, (response) => {
            if (response && response.tags) renderTagList(response.tags);
        });
    }
}

function renderTagList(tags) {
    const list = document.getElementById('tagList');
    list.innerHTML = '';
    tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag-item';
        span.textContent = tag.toUpperCase();
        span.onclick = () => {
            document.querySelectorAll('.tag-item').forEach(el => el.classList.remove('active'));
            span.classList.add('active');
            selectedTag = tag;
            loadTagSettings(tag);
        };
        list.appendChild(span);
    });
}

function loadTagSettings(tag) {
    document.getElementById('editorPanel').style.display = 'block';
    document.getElementById('activeTagName').textContent = `Düzenlenen: <${tag.toUpperCase()}>`;
    
    let defaults = DEFAULTS.tagSettings[tag];
    if (!defaults) {
        if (tag === 'h1') defaults = { fontSize: 34, lineHeight: 1.3, fontColor: '#e8eaed' };
        else if (tag === 'h2') defaults = { fontSize: 26, lineHeight: 1.4, fontColor: '#e0e2e8' };
        else if (tag === 'h3') defaults = { fontSize: 21, lineHeight: 1.5, fontColor: '#c0c4ce' };
        else defaults = { fontSize: 18, lineHeight: 1.9, fontColor: '#d0d3dc' };
    }
    
    const s = tagSettings[tag] || defaults;
    document.getElementById('fontSize').value = s.fontSize;
    document.getElementById('lineHeight').value = s.lineHeight;
    document.getElementById('fontColor').value = s.fontColor;
    updateDisplayValues();
}

function updateDisplayValues() {
    document.getElementById('fontSizeVal').textContent = document.getElementById('fontSize').value + 'px';
    document.getElementById('lineHeightVal').textContent = document.getElementById('lineHeight').value;
    document.getElementById('maxWidthVal').textContent = document.getElementById('maxWidth').value + 'px';
}

function collectData() {
    if (selectedTag) {
        tagSettings[selectedTag] = {
            fontSize: document.getElementById('fontSize').value,
            lineHeight: document.getElementById('lineHeight').value,
            fontColor: document.getElementById('fontColor').value
        };
    }
    return {
        focusActive: document.getElementById('focusToggle').checked,
        bgColor: document.getElementById('bgColor').value,
        maxWidth: document.getElementById('maxWidth').value,
        sourceLang: document.getElementById('sourceLang').value,
        targetLang: document.getElementById('targetLang').value,
        translateActive: document.getElementById('translateToggle').checked,
        tagSettings: tagSettings
    };
}

function broadcastChanges() {
    const data = collectData();
    const storageData = { ...data };
    delete storageData.focusActive;

    // Her zaman kaydet — koşulsuz
    chrome.storage.local.set(storageData);

    // Canlı güncelleme gönder
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "liveUpdate", data: data });
    });
}

// Tüm ayarları UI'a yansıt
function applyToUI(data) {
    document.getElementById('focusToggle').checked = data.focusActive || false;
    document.getElementById('bgColor').value = data.bgColor || DEFAULTS.bgColor;
    document.getElementById('maxWidth').value = data.maxWidth || DEFAULTS.maxWidth;
    document.getElementById('sourceLang').value = data.sourceLang || DEFAULTS.sourceLang;
    document.getElementById('targetLang').value = data.targetLang || DEFAULTS.targetLang;
    document.getElementById('translateToggle').checked = data.translateActive !== undefined ? data.translateActive : DEFAULTS.translateActive;
    tagSettings = data.tagSettings || JSON.parse(JSON.stringify(DEFAULTS.tagSettings));
    
    // Seçili tag varsa değerlerini güncelle
    if (selectedTag) {
        loadTagSettings(selectedTag);
    }
    updateDisplayValues();
}

// Varsayılana Dön butonu
document.getElementById('resetDefaults').addEventListener('click', () => {
    const resetData = JSON.parse(JSON.stringify(DEFAULTS));
    resetData.focusActive = document.getElementById('focusToggle').checked; // Focus durumunu koru
    resetData.translateActive = document.getElementById('translateToggle').checked; // Çeviri durumunu koru
    selectedTag = null;
    document.getElementById('editorPanel').style.display = 'none';
    document.querySelectorAll('.tag-item').forEach(el => el.classList.remove('active'));
    applyToUI(resetData);
    
    const storageData = { ...resetData };
    delete storageData.focusActive;
    chrome.storage.local.set(storageData);

    // Sayfaya da gönder
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "liveUpdate", data: resetData });
    });
});

// Event listener'lar
let userInteracted = false;
const inputControlIds = ['fontSize', 'lineHeight', 'fontColor', 'bgColor', 'maxWidth'];
const checkboxControlIds = ['focusToggle', 'translateToggle'];
const selectControlIds = ['sourceLang', 'targetLang'];

inputControlIds.forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
        updateDisplayValues();
        broadcastChanges();
    });
});

checkboxControlIds.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        userInteracted = true;
        updateDisplayValues();
        broadcastChanges();
    });
});

selectControlIds.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        broadcastChanges();
    });
});

// Sayfa açıldığında kayıtlı ayarları yükle
chrome.storage.local.get(null, (data) => {
    if (Object.keys(data).length > 0) {
        applyToUI(data);
    }
    updateDisplayValues();
    analyzeTags();

    // Geçerli sekmenin durumunu sor
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getState" }, (response) => {
                if (userInteracted) return;
                if (!chrome.runtime.lastError && response) {
                    document.getElementById('focusToggle').checked = response.isActive;
                    document.getElementById('translateToggle').checked = response.translateActive;
                } else {
                    document.getElementById('focusToggle').checked = false;
                }
            });
        }
    });
});