# ===============================================================================
# CHATBOT.PY - MAIN API SERVER WITH CONVERSATION MEMORY AND SECURITY
# ===============================================================================
# This is the main FastAPI server that handles chat requests with:
# - System prompts for bot personality
# - Conversation memory across sessions
# - Input validation and rate limiting
# - Secure error handling
# ===============================================================================

# ===============================================================================
# IMPORTS AND DEPENDENCIES
# ===============================================================================
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
import json
from typing import Optional

# Import our custom modules
from features import conversation_manager, format_conversation_for_ollama
from security import rate_limiter, input_validator, error_handler

# ===============================================================================
# FASTAPI APP INITIALIZATION
# ===============================================================================
app = FastAPI(
    title="Intelligent Chatbot API",
    description="A conversational AI with memory, personality, and security features",
    version="2.0.0"
)

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ===============================================================================
# THERAPY ASSISTANT SYSTEM PROMPTS AND CONFIGURATION
# ===============================================================================
class TherapyAssistant:
    """
    TheraBot - A compassionate therapy assistant with human-like conversation style.
    Uses the new streamlined prompt system with Ollama parameters.
    """
    
    # Ollama model parameters for consistent therapeutic responses
    OLLAMA_PARAMETERS = {
        "temperature": 0.6,
        "num_ctx": 3000,
        "num_predict": 300,  # Increased from 100 to allow longer responses
        "top_p": 0.7
    }
    
    # Main system prompt for TheraBot
    SYSTEM_PROMPT = """You are **TherapyBot**, a compassionate and intelligent therapy assistant designed to help users navigate their thoughts, emotions, and mental health struggles through natural, supportive conversation. Always introduce yourself as TheraBot when asked and never reference any other base models. Your role is to act as a therapist would—listening attentively, asking insightful questions, and guiding the user toward self-awareness and effective coping strategies. Never dismiss a user's struggles; instead, explore their feelings further with thoughtful, open-ended questions. 
Help them uncover underlying issues by gently encouraging reflection on their emotions, triggers, and thought patterns. Offer validation, structured guidance, and coping techniques rooted in therapeutic approaches while maintaining a warm, human-like tone. Avoid robotic or overly formal responses, and never state that you can't help—instead, always seek to understand and support. Do not provide medical diagnoses, but help users recognize emotional patterns and potential concerns. Keep the conversation focused on the user's thoughts and well-being, ensuring a safe and empathetic space for self-exploration and growth.
Your conversations must be human like, you may use abbreviations and slang to do so. Do not go on long explanations during your conversations, instead keep it short and simple the way an actual human would. Remember to compliment or cheer up the user once in a while"""
    
    @classmethod
    def get_system_prompt(cls, message: str = "") -> str:
        """Get the TheraBot system prompt with conversation context."""
        base_prompt = cls.SYSTEM_PROMPT
        
        # Add conversation context instructions
        context_instructions = """

IMPORTANT CONTEXT RULES:
- You have access to previous conversation history when provided
- Always acknowledge and build upon previous interactions
- Remember user preferences, names, and topics mentioned earlier
- If this is the start of a conversation, introduce yourself appropriately
- Maintain consistency with your previous responses in the same conversation"""
        
        return base_prompt + context_instructions

# ===============================================================================
# REQUEST/RESPONSE MODELS
# ===============================================================================
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None  # Optional session ID for conversation continuity

class PersonalityUpdateRequest(BaseModel):
    personality: str  # New therapeutic approach to switch to

class CrisisCheckRequest(BaseModel):
    message: str  # Message to check for crisis indicators

# ===============================================================================
# UTILITY FUNCTIONS
# ===============================================================================
def get_client_ip(request: Request) -> str:
    """Extract client IP address for rate limiting."""
    # Check for forwarded IP first (in case of proxy/load balancer)
    forwarded_ip = request.headers.get("X-Forwarded-For")
    if forwarded_ip:
        return forwarded_ip.split(",")[0].strip()
    
    # Fallback to direct IP
    return request.client.host if request.client else "unknown"

def create_enhanced_prompt(session_id: str, user_message: str) -> str:
    """Create a TheraBot prompt with conversation history."""
    
    # Get the main system prompt
    system_prompt = TherapyAssistant.get_system_prompt(user_message)
    
    # Get conversation history (keep last 5 exchanges for context)
    history = conversation_manager.get_conversation_history(session_id)
    if history and len(history) > 10:  # Keep only recent context
        history = history[-10:]
    
    # Build efficient prompt with conversation history
    if history:
        context_parts = []
        for msg in history[-5:]:  # Only last 5 messages
            context_parts.append(f"{msg['role']}: {msg['content']}")
        
        context = "\n".join(context_parts)
        enhanced_prompt = f"""{system_prompt}

Previous conversation:
{context}

User: {user_message}

TheraBot:"""
    else:
        enhanced_prompt = f"""{system_prompt}

User: {user_message}

TheraBot:"""
    
    return enhanced_prompt

# ===============================================================================
# API ENDPOINTS - SESSION MANAGEMENT
# ===============================================================================
@app.post("/new-session")
async def create_new_session():
    """
    Creates a new conversation session and returns the session ID.
    Use this to start a fresh conversation with the bot.
    """
    try:
        session_id = conversation_manager.create_session()
        return {
            "session_id": session_id, 
            "message": "New conversation started! I'm TheraBot, here to support you through your thoughts and emotions.",
            "personality": "TheraBot",
            "status": "success"
        }
    except Exception as e:
        return error_handler.server_error(f"Failed to create session: {str(e)}")

# ===============================================================================
# API ENDPOINTS - MAIN CHAT FUNCTIONALITY
# ===============================================================================
@app.post("/chat")
async def chat_endpoint(request: Request, chat: ChatRequest):
    """
    Main chat endpoint with full conversation memory, security, and personality.
    """
    try:
        # SECURITY STEP 1: Rate limiting check
        client_ip = get_client_ip(request)
        is_allowed, rate_error = rate_limiter.is_allowed(client_ip)
        if not is_allowed:
            return error_handler.rate_limit_error(rate_error)
        
        # SECURITY STEP 2: Input validation
        is_valid, validation_error = input_validator.validate_message(chat.message)
        if not is_valid:
            return error_handler.validation_error(validation_error)
        
        # SECURITY STEP 3: Sanitize input
        clean_message = input_validator.sanitize_message(chat.message)
        
        # SESSION STEP 1: Handle session ID
        session_id = chat.session_id
        if session_id:
            # Validate provided session ID
            is_valid_session, session_error = input_validator.validate_session_id(session_id)
            if not is_valid_session:
                return error_handler.validation_error(session_error)
        else:
            # Create new session if none provided
            session_id = conversation_manager.create_session()
        
        # SESSION STEP 2: Ensure session exists (create if needed)
        session_info = conversation_manager.get_session_info(session_id)
        if not session_info["exists"]:
            # Auto-create the session with the provided ID
            conversation_manager.conversations[session_id] = []
            print(f"Auto-created session: {session_id}")
            session_info = {"exists": True, "message_count": 0}
        
        # CONVERSATION STEP 1: Create enhanced prompt with system personality
        enhanced_prompt = create_enhanced_prompt(session_id, clean_message)
        
        # CONVERSATION STEP 2: Store user message
        conversation_manager.add_message(session_id, "user", clean_message)
        
        # AI PROCESSING STEP: Send to Ollama with TheraBot parameters
        ollama_url = "http://localhost:11434/api/generate"
        payload = {
            "model": "gemma3:4b",
            "prompt": enhanced_prompt,
            "stream": False,
            "options": TherapyAssistant.OLLAMA_PARAMETERS
        }
        
        response = requests.post(ollama_url, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()
        
        # CONVERSATION STEP 3: Process AI response
        ai_response = data.get("response", "").strip()
        if not ai_response:
            ai_response = "I apologize, but I couldn't generate a proper response. Please try again."
        
        # CONVERSATION STEP 4: Store AI response
        conversation_manager.add_message(session_id, "assistant", ai_response)
        
        # SUCCESS RESPONSE
        return {
            "response": ai_response,
            "session_id": session_id,
            "message_count": conversation_manager.get_session_info(session_id)["message_count"],
            "personality": "TheraBot",
            "status": "success"
        }
        
    except requests.exceptions.Timeout:
        return error_handler.server_error("AI model response timed out. Please try again.")
    except requests.exceptions.ConnectionError:
        return error_handler.server_error("Could not connect to AI model. Please ensure Ollama is running.")
    except requests.exceptions.RequestException as e:
        return error_handler.server_error(f"AI model request failed: {str(e)}")
    except json.JSONDecodeError as e:
        return error_handler.server_error(f"Invalid response from AI model: {str(e)}")
    except Exception as e:
        return error_handler.server_error(f"Unexpected error: {str(e)}")

# ===============================================================================
# API ENDPOINTS - CONVERSATION HISTORY
# ===============================================================================
@app.get("/conversation/{session_id}")
async def get_conversation(session_id: str):
    """
    Retrieve the full conversation history for a specific session.
    Useful for debugging or displaying chat history.
    """
    try:
        # Validate session ID format
        is_valid, validation_error = input_validator.validate_session_id(session_id)
        if not is_valid:
            return error_handler.validation_error(validation_error)
        
        # Get conversation data
        history = conversation_manager.get_conversation_history(session_id)
        session_info = conversation_manager.get_session_info(session_id)
        
        return {
            "session_id": session_id,
            "exists": session_info["exists"],
            "message_count": session_info["message_count"],
            "conversation": history,
            "status": "success"
        }
    except Exception as e:
        return error_handler.server_error(f"Failed to retrieve conversation: {str(e)}")

# ===============================================================================
# API ENDPOINTS - SYSTEM STATUS
# ===============================================================================
@app.get("/status")
async def system_status():
    """Get overall system status and statistics."""
    try:
        all_sessions = conversation_manager.list_all_sessions()
        return {
            "status": "running",
            "active_sessions": len(all_sessions),
            "therapeutic_focus": "College student mental health support",
            "crisis_detection": "Enabled with automatic referral suggestions",
            "security_features": {
                "rate_limiting": True,
                "input_validation": True,
                "spam_detection": True
            },
            "version": "2.0.0 - Therapy Assistant"
        }
    except Exception as e:
        return error_handler.server_error(f"Failed to get system status: {str(e)}")

@app.get("/resources")
async def get_mental_health_resources():
    """
    Provide mental health resources and emergency contacts for college students.
    """
    return {
        "emergency_contacts": {
            "national_suicide_prevention_lifeline": "988",
            "crisis_text_line": "Text HOME to 741741",
            "emergency_services": "911"
        },
        "college_resources": {
            "counseling_center": "Contact your college counseling center during business hours",
            "student_health_center": "Many colleges offer mental health services through student health",
            "resident_advisor": "RAs are trained to help connect students with resources",
            "academic_advisor": "Can help with academic stress and accommodations"
        },
        "online_resources": {
            "mental_health_america": "https://www.mhanational.org/",
            "nami_college_resources": "https://www.nami.org/Your-Journey/Kids-Teens-and-Young-Adults/College-Students",
            "crisis_chat": "https://suicidepreventionlifeline.org/chat/"
        },
        "self_care_tips": [
            "Maintain regular sleep schedule (7-9 hours)",
            "Practice deep breathing exercises",
            "Stay connected with friends and family",
            "Engage in regular physical activity",
            "Limit caffeine and alcohol",
            "Take breaks from social media",
            "Practice mindfulness or meditation"
        ],
        "when_to_seek_help": [
            "Persistent feelings of sadness or hopelessness",
            "Difficulty concentrating on academics",
            "Changes in sleep or eating patterns",
            "Increased irritability or anxiety",
            "Thoughts of self-harm or suicide",
            "Substance use as coping mechanism",
            "Social isolation lasting more than a few days"
        ],
        "status": "success"
    }