// Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8787'
    : 'https://voice-translator.YOUR-SUBDOMAIN.workers.dev';

const SESSION_ID = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// DOM Elements
const recordBtn = document.getElementById('recordBtn');
const recordingStatus = document.getElementById('recordingStatus');
const originalText = document.getElementById('originalText');
const translatedText = document.getElementById('translatedText');
const speakBtn = document.getElementById('speakBtn');
const sourceLang = document.getElementById('sourceLang');
const targetLang = document.getElementById('targetLang');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// State
let mediaRecorder;
let audioChunks = [];
let isRecording = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkBrowserSupport();
    loadHistory();

    recordBtn.addEventListener('click', toggleRecording);
    speakBtn.addEventListener('click', speakTranslation);
    clearHistoryBtn.addEventListener('click', clearHistory);
});

// Check browser support for required APIs
function checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showStatus('❌ Your browser does not support audio recording', 'error');
        recordBtn.disabled = true;
        return false;
    }

    if (!('speechSynthesis' in window)) {
        showStatus('⚠️ Text-to-speech not supported in your browser', 'warning');
    }

    return true;
}

// Toggle recording
async function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
}

// Start recording
async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Use webm format with opus codec (supported by Whisper)
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            await processAudio(audioBlob);

            // Stop all tracks
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;

        recordBtn.classList.add('recording');
        recordBtn.querySelector('.text').textContent = 'Stop Recording';
        showStatus('🎤 Recording... Click again to stop', 'recording');

    } catch (error) {
        console.error('Error starting recording:', error);
        showStatus('❌ Could not access microphone', 'error');
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;

        recordBtn.classList.remove('recording');
        recordBtn.querySelector('.text').textContent = 'Start Recording';
        showStatus('⏸️ Processing audio...', 'processing');
    }
}

// Process recorded audio
async function processAudio(audioBlob) {
    try {
        // Step 1: Transcribe audio
        showStatus('🔄 Transcribing speech...', 'processing');
        const transcription = await transcribeAudio(audioBlob);

        if (!transcription || !transcription.text) {
            throw new Error('No transcription received');
        }

        originalText.textContent = transcription.text;
        showStatus('✅ Transcription complete', 'success');

        // Step 2: Translate text
        showStatus('🔄 Translating...', 'processing');
        const translation = await translateText(
            transcription.text,
            sourceLang.value === 'auto' ? transcription.language : sourceLang.value,
            targetLang.value
        );

        if (!translation || !translation.translatedText) {
            throw new Error('No translation received');
        }

        translatedText.textContent = translation.translatedText;
        speakBtn.disabled = false;

        const cacheMsg = translation.cached ? ' (cached)' : '';
        showStatus(`✅ Translation complete${cacheMsg}`, 'success');

        // Add to history display
        addToHistoryDisplay(transcription.text, translation.translatedText);

    } catch (error) {
        console.error('Error processing audio:', error);
        showStatus(`❌ Error: ${error.message}`, 'error');
    }
}

// Transcribe audio using Workers AI Whisper
async function transcribeAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
    }

    return await response.json();
}

// Translate text using Llama 3.3
async function translateText(text, sourceLang, targetLang) {
    const response = await fetch(`${API_BASE_URL}/api/translate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text,
            sourceLang,
            targetLang,
            sessionId: SESSION_ID
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Translation failed');
    }

    return await response.json();
}

// Speak translation using Web Speech API
function speakTranslation() {
    const text = translatedText.textContent;

    if (!text || text === 'Translation will appear here...') {
        return;
    }

    if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Try to match the target language
        const targetLangCode = getLanguageCode(targetLang.value);
        const voices = window.speechSynthesis.getVoices();
        const matchingVoice = voices.find(voice => voice.lang.startsWith(targetLangCode));

        if (matchingVoice) {
            utterance.voice = matchingVoice;
        }

        utterance.lang = targetLangCode;
        utterance.rate = 0.9;
        utterance.pitch = 1;

        utterance.onstart = () => {
            speakBtn.querySelector('.text').textContent = 'Speaking...';
            speakBtn.disabled = true;
        };

        utterance.onend = () => {
            speakBtn.querySelector('.text').textContent = 'Speak Translation';
            speakBtn.disabled = false;
        };

        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            speakBtn.querySelector('.text').textContent = 'Speak Translation';
            speakBtn.disabled = false;
            showStatus('❌ Speech synthesis failed', 'error');
        };

        window.speechSynthesis.speak(utterance);
    } else {
        showStatus('❌ Text-to-speech not supported', 'error');
    }
}

// Get language code for Web Speech API
function getLanguageCode(language) {
    const languageCodes = {
        'English': 'en-US',
        'Spanish': 'es-ES',
        'French': 'fr-FR',
        'German': 'de-DE',
        'Italian': 'it-IT',
        'Portuguese': 'pt-PT',
        'Chinese': 'zh-CN',
        'Japanese': 'ja-JP',
        'Korean': 'ko-KR',
        'Arabic': 'ar-SA',
        'Russian': 'ru-RU'
    };

    return languageCodes[language] || 'en-US';
}

// Add translation to history display
function addToHistoryDisplay(original, translated) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';

    const now = new Date().toLocaleTimeString();

    historyItem.innerHTML = `
        <div class="original">${original}</div>
        <div class="translated">→ ${translated}</div>
        <div class="meta">${sourceLang.value} → ${targetLang.value} • ${now}</div>
    `;

    historyList.insertBefore(historyItem, historyList.firstChild);
}

// Load conversation history from Durable Object
async function loadHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/history?sessionId=${SESSION_ID}`);

        if (response.ok) {
            const data = await response.json();

            if (data.translations && data.translations.length > 0) {
                historyList.innerHTML = '';
                data.translations.reverse().forEach(entry => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';

                    const time = new Date(entry.timestamp).toLocaleTimeString();

                    historyItem.innerHTML = `
                        <div class="original">${entry.original}</div>
                        <div class="translated">→ ${entry.translated}</div>
                        <div class="meta">${entry.sourceLang || 'auto'} → ${entry.targetLang} • ${time}</div>
                    `;

                    historyList.appendChild(historyItem);
                });
            }
        }
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

// Clear history
function clearHistory() {
    historyList.innerHTML = '<p style="color: #999; text-align: center;">No translations yet</p>';
    showStatus('🗑️ History cleared', 'success');
}

// Show status message
function showStatus(message, type = 'info') {
    recordingStatus.textContent = message;
    recordingStatus.className = `status ${type}`;

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            if (recordingStatus.textContent === message) {
                recordingStatus.textContent = '';
            }
        }, 3000);
    }
}

// Load voices when they're ready (for speech synthesis)
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
