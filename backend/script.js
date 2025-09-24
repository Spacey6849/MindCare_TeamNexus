// ===============================================================================
// THERAPY ASSISTANT CHATBOT - JAVASCRIPT FUNCTIONALITY
// ===============================================================================
// This file handles all frontend interactions - NO data storage, just UI
// ===============================================================================

// ===============================================================================
// GLOBAL VARIABLES AND STATE
// ===============================================================================
let currentSessionId = null; // Will be managed by your backend
let isWaitingForResponse = false;

// DOM Elements
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const charCount = document.getElementById('charCount');
const loadingMessage = document.getElementById('loadingMessage');
const resourcesSidebar = document.getElementById('resourcesSidebar');
const resourcesBtn = document.getElementById('resourcesBtn');
const closeSidebar = document.getElementById('closeSidebar');
const newChatBtn = document.getElementById('newChatBtn');

// ===============================================================================
// INITIALIZATION
// ===============================================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Therapy Assistant Frontend Loaded');
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Focus on input
    messageInput.focus();
    
    // Auto-resize textarea
    setupTextareaAutoResize();
    
    // Initialize quick options
    setupQuickOptions();
    
    console.log('Frontend ready for backend integration');
});

// ===============================================================================
// EVENT LISTENERS SETUP
// ===============================================================================
function initializeEventListeners() {
    // Message input events
    messageInput.addEventListener('input', handleInputChange);
    messageInput.addEventListener('keydown', handleKeyPress);
    
    // Send button
    sendButton.addEventListener('click', sendMessage);
    
    // Floating action buttons
    resourcesBtn.addEventListener('click', toggleResourcesSidebar);
    closeSidebar.addEventListener('click', closeResourcesSidebar);
    newChatBtn.addEventListener('click', startNewChat);
    
    // Close sidebar when clicking outside
    document.addEventListener('click', handleOutsideClick);
}

// ===============================================================================
// MESSAGE INPUT HANDLING
// ===============================================================================
function handleInputChange() {
    const message = messageInput.value.trim();
    const length = messageInput.value.length;
    
    // Update character count
    charCount.textContent = `${length}/1000`;
    
    // Update send button state
    sendButton.disabled = message.length === 0 || isWaitingForResponse;
    
    // Visual feedback for character limit
    if (length > 900) {
        charCount.style.color = 'var(--warning)';
    } else if (length > 950) {
        charCount.style.color = 'var(--error)';
    } else {
        charCount.style.color = 'var(--text-light)';
    }
}

function handleKeyPress(event) {
    // Send message on Enter (but allow Shift+Enter for new lines)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (!sendButton.disabled) {
            sendMessage();
        }
    }
}

function setupTextareaAutoResize() {
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

// ===============================================================================
// QUICK OPTIONS HANDLING
// ===============================================================================
function setupQuickOptions() {
    const quickOptions = document.querySelectorAll('.quick-option');
    
    quickOptions.forEach(option => {
        option.addEventListener('click', function() {
            const message = this.getAttribute('data-message');
            messageInput.value = message;
            handleInputChange();
            
            // Hide quick options after selection
            const quickOptionsContainer = document.querySelector('.quick-options-container');
            quickOptionsContainer.style.display = 'none';
            
            // Auto-send the message
            setTimeout(() => {
                sendMessage();
            }, 300);
        });
    });
}

// ===============================================================================
// CORE MESSAGING FUNCTIONS (Ready for Backend Integration)
// ===============================================================================
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || isWaitingForResponse) return;
    
    // Add user message to chat
    addUserMessage(message);
    
    // Clear input and disable send button
    messageInput.value = '';
    messageInput.style.height = 'auto';
    handleInputChange();
    isWaitingForResponse = true;
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // TODO: Replace this with actual API call to your backend
        const response = await callBackendAPI(message);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add bot response to chat
        addBotMessage(response.response);
        
        // Update session ID if provided
        if (response.session_id) {
            currentSessionId = response.session_id;
        }
        
    } catch (error) {
        console.error('Error sending message:', error);
        hideTypingIndicator();
        
        // Show error message
        addBotMessage(
            "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or if you're experiencing a crisis, please contact emergency services or a crisis hotline immediately.",
            true // isError flag
        );
    } finally {
        isWaitingForResponse = false;
        handleInputChange();
        messageInput.focus();
    }
}

// ===============================================================================
// BACKEND API INTEGRATION (Ready for your backend)
// ===============================================================================
async function callBackendAPI(message) {
    // TODO: Replace this mock with actual API call to your backend
    console.log('Calling backend API with message:', message);
    console.log('Current session ID:', currentSessionId);
    
    // Mock API call - REPLACE THIS with your actual backend call
    const mockResponse = await simulateBackendCall(message);
    return mockResponse;
    
    /* 
    // ACTUAL API CALL - Uncomment and modify when ready:
    const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message,
            session_id: currentSessionId
        })
    });
    
    if (!response.ok) {
        throw new Error('Network response was not ok');
    }
    
    return await response.json();
    */
}

// Mock backend response - REMOVE THIS when connecting to real backend
async function simulateBackendCall(message) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock responses based on message content
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('anxious') || lowerMessage.includes('anxiety')) {
        return {
            response: "I understand you're feeling anxious, and that can be really overwhelming. Anxiety is a common experience for many students, and you're not alone in feeling this way.\n\nHere are some immediate techniques that might help:\n• Take slow, deep breaths - in for 4 counts, hold for 4, out for 4\n• Try grounding yourself by naming 5 things you can see, 4 you can hear, 3 you can touch\n• Remember that this feeling will pass\n\nIf your anxiety is significantly impacting your daily life or studies, I'd encourage you to speak with a counselor at your college's counseling center. They have specialized training to help with anxiety and can provide ongoing support.\n\nWhat specific situations tend to make you feel most anxious?",
            session_id: "mock-session-" + Date.now(),
            personality: "supportive_listener"
        };
    }
    
    if (lowerMessage.includes('stress') || lowerMessage.includes('overwhelmed')) {
        return {
            response: "Feeling overwhelmed and stressed is incredibly common among students - you're definitely not alone in this experience. College can bring so many pressures from academics, social situations, and planning for the future.\n\nSome strategies that many students find helpful:\n• Break large tasks into smaller, manageable steps\n• Prioritize your most important tasks and be okay with 'good enough' on others\n• Make sure you're getting adequate sleep and nutrition\n• Schedule regular breaks and activities you enjoy\n\nIt sounds like you're dealing with a lot right now. Would it be helpful to talk about what's causing the most stress for you? Sometimes just talking through what's on your mind can help make things feel more manageable.\n\nI'd also encourage you to reach out to your college counseling center - they have resources specifically designed to help students manage stress and overwhelm.",
            session_id: currentSessionId || "mock-session-" + Date.now(),
            personality: "supportive_listener"
        };
    }
    
    // Default supportive response
    return {
        response: "Thank you for sharing that with me. I'm here to listen and support you through whatever you're experiencing. Your feelings are valid, and it takes courage to reach out for support.\n\nWould you like to tell me more about what's on your mind? I'm here to help in whatever way I can, whether that's providing coping strategies, a listening ear, or helping you connect with additional resources if needed.",
        session_id: currentSessionId || "mock-session-" + Date.now(),
        personality: "supportive_listener"
    };
}

// ===============================================================================
// UI MESSAGE FUNCTIONS
// ===============================================================================
function addUserMessage(message) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper user-message';
    
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageWrapper.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="message-content">
            <div class="message-bubble user">
                <div class="message-text">
                    <p>${escapeHtml(message)}</p>
                </div>
                <div class="message-time">${currentTime}</div>
            </div>
        </div>
    `;
    
    // Remove quick options if they exist
    const quickOptionsContainer = document.querySelector('.quick-options-container');
    if (quickOptionsContainer) {
        quickOptionsContainer.style.display = 'none';
    }
    
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
}

function addBotMessage(message, isError = false) {
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message-wrapper bot-message';
    
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Format message with line breaks
    const formattedMessage = formatMessageText(message);
    
    messageWrapper.innerHTML = `
        <div class="message-avatar">
            <i class="fas fa-heart"></i>
        </div>
        <div class="message-content">
            <div class="message-bubble bot ${isError ? 'error' : ''}">
                <div class="message-text">
                    ${formattedMessage}
                </div>
                <div class="message-time">${currentTime}</div>
            </div>
        </div>
    `;
    
    chatContainer.appendChild(messageWrapper);
    scrollToBottom();
}

function formatMessageText(text) {
    // Convert line breaks to HTML
    return escapeHtml(text)
        .replace(/\n/g, '<br>')
        .replace(/\• /g, '<br>• ') // Format bullet points
        .replace(/(\d+\. )/g, '<br>$1'); // Format numbered lists
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showTypingIndicator() {
    loadingMessage.style.display = 'block';
    scrollToBottom();
}

function hideTypingIndicator() {
    loadingMessage.style.display = 'none';
}

function scrollToBottom() {
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// ===============================================================================
// SIDEBAR FUNCTIONS
// ===============================================================================
function toggleResourcesSidebar() {
    resourcesSidebar.classList.toggle('open');
}

function closeResourcesSidebar() {
    resourcesSidebar.classList.remove('open');
}

function handleOutsideClick(event) {
    if (resourcesSidebar.classList.contains('open') && 
        !resourcesSidebar.contains(event.target) && 
        event.target !== resourcesBtn) {
        closeResourcesSidebar();
    }
}

// ===============================================================================
// CHAT MANAGEMENT
// ===============================================================================
function startNewChat() {
    // Confirm with user
    if (confirm('Start a new conversation? This will begin a fresh session.')) {
        // Reset session
        currentSessionId = null;
        
        // Clear chat (keep welcome message)
        const messages = chatContainer.querySelectorAll('.message-wrapper:not(:first-child)');
        messages.forEach(message => message.remove());
        
        // Clear loading indicator
        hideTypingIndicator();
        
        // Show quick options again
        const quickOptionsContainer = document.querySelector('.quick-options-container');
        if (quickOptionsContainer) {
            quickOptionsContainer.style.display = 'block';
        }
        
        // Reset input state
        messageInput.value = '';
        handleInputChange();
        messageInput.focus();
        
        console.log('New chat session started');
    }
}

// ===============================================================================
// UTILITY FUNCTIONS
// ===============================================================================
function getCurrentTimestamp() {
    return new Date().toISOString();
}

function debugLog(message, data = null) {
    console.log(`[Therapy Assistant] ${message}`, data || '');
}

// ===============================================================================
// ERROR HANDLING
// ===============================================================================
window.addEventListener('error', function(event) {
    console.error('Frontend error:', event.error);
    
    // Show user-friendly error message if chat is broken
    if (isWaitingForResponse) {
        hideTypingIndicator();
        addBotMessage(
            "I'm experiencing some technical difficulties. Please try refreshing the page, or if you need immediate support, please contact your college counseling center or a crisis hotline.",
            true
        );
        isWaitingForResponse = false;
        handleInputChange();
    }
});

// ===============================================================================
// EXPORT FUNCTIONS FOR BACKEND INTEGRATION
// ===============================================================================
// These functions can be called externally when integrating with your backend

window.TherapyAssistantUI = {
    // Function to manually add a message (useful for testing)
    addMessage: function(message, isUser = false) {
        if (isUser) {
            addUserMessage(message);
        } else {
            addBotMessage(message);
        }
    },
    
    // Function to set session ID from external source
    setSessionId: function(sessionId) {
        currentSessionId = sessionId;
        console.log('Session ID set to:', sessionId);
    },
    
    // Function to get current session ID
    getSessionId: function() {
        return currentSessionId;
    },
    
    // Function to clear chat
    clearChat: startNewChat,
    
    // Function to show/hide typing indicator
    showTyping: showTypingIndicator,
    hideTyping: hideTypingIndicator
};

console.log('Therapy Assistant Frontend fully initialized and ready for backend integration!');