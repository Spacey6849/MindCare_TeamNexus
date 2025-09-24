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
from fastapi.responses import StreamingResponse
from fastapi import BackgroundTasks
import os
import uuid
import smtplib
from email.message import EmailMessage
from datetime import datetime, timedelta
import asyncio

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

try:
    from dotenv import load_dotenv, find_dotenv  # optional: used for local development
    # Load environment variables from backend/.env (local development)
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    # Also search up the tree as a fallback
    discovered = find_dotenv(env_path) or find_dotenv()
    load_dotenv(discovered or env_path, override=True)
except Exception:
    # Don't fail import if python-dotenv isn't installed; warn and continue.
    print("Warning: python-dotenv not installed, .env file not loaded. Install via 'pip install python-dotenv' to load backend/.env automatically.")


    @app.on_event("startup")
    async def _print_env_debug():
        # Print masked presence of critical env vars for local debugging (do not log secrets in production)
        supa_url = os.getenv('SUPABASE_URL')
        supa_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        def mask(s):
            if not s:
                return None
            return s[:6] + '...' + str(len(s))
        print(f"[startup] SUPABASE_URL={'set' if supa_url else 'NOT_SET'}, SUPABASE_SERVICE_ROLE_KEY={mask(supa_key)}")


    @app.get("/health")
    async def health():
        supa_url = bool(os.getenv('SUPABASE_URL'))
        supa_role = bool(os.getenv('SUPABASE_SERVICE_ROLE_KEY'))
        smtp_ok = all([
            os.getenv('SMTP_HOST'),
            os.getenv('SMTP_PORT'),
            os.getenv('SMTP_USER'),
            os.getenv('SMTP_PASS')
        ])
        return {
            "status": "ok",
            "supabaseUrlSet": supa_url,
            "serviceRoleSet": supa_role,
            "smtpConfigured": smtp_ok
        }

# Add CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    # Allow local frontend dev servers (Vite may pick 8080 or 8081)
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# ===============================================================================
# THERAPY ASSISTANT SYSTEM PROMPTS AND CONFIGURATION
# ===============================================================================
class TherapyAssistant:
    """
    MindCareAI - A compassionate therapy assistant with human-like conversation style.
    Uses the new streamlined prompt system with Ollama parameters.
    """
    # Default/current therapeutic approach
    CURRENT_PERSONALITY = "MindCareAI"

    # Available therapy approaches (minimal placeholders for now)
    THERAPY_PERSONALITIES = {
        "MindCareAI": "Compassionate, supportive general therapy assistant",
        "CBT": "Cognitive Behavioral Therapy-inspired guidance",
        "Mindfulness": "Mindfulness-based stress reduction focus",
        "Supportive": "Warm, empathetic supportive counseling style",
    }
    
    # Ollama model parameters for consistent therapeutic responses
    OLLAMA_PARAMETERS = {
        "temperature": 0.6,
        "num_ctx": 3000,
        "num_predict": 300,  # Increased from 100 to allow longer responses
        "top_p": 0.7
    }
    
    # Main system prompt for MindCareAI
    SYSTEM_PROMPT = """You are **MindCareAI**, a compassionate and intelligent therapy assistant designed to help users navigate their thoughts, emotions, and mental health struggles through natural, supportive conversation. Always introduce yourself as MindCareAI when asked and never reference any other base models. Your role is to act as a therapist would—listening attentively, asking insightful questions, and guiding the user toward self-awareness and effective coping strategies. Never dismiss a user's struggles; instead, explore their feelings further with thoughtful, open-ended questions. 
Help them uncover underlying issues by gently encouraging reflection on their emotions, triggers, and thought patterns. Offer validation, structured guidance, and coping techniques rooted in therapeutic approaches while maintaining a warm, human-like tone. Avoid robotic or overly formal responses, and never state that you can't help—instead, always seek to understand and support. Do not provide medical diagnoses, but help users recognize emotional patterns and potential concerns. Keep the conversation focused on the user's thoughts and well-being, ensuring a safe and empathetic space for self-exploration and growth.
Your conversations must be human like, you may use abbreviations and slang to do so. Do not go on long explanations during your conversations, instead keep it short and simple the way an actual human would. Remember to compliment or cheer up the user once in a while"""
    
    @classmethod
    def get_system_prompt(cls, message: str = "") -> str:
        """Get the MindCareAI system prompt with conversation context."""
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

    # --- Simple heuristics used by endpoints below ---
    @staticmethod
    def detect_crisis(message: str) -> bool:
        if not message:
            return False
        text = message.lower()
        crisis_terms = [
            "suicide", "kill myself", "end my life", "self-harm", "cut myself",
            "can't go on", "hopeless", "overdose"
        ]
        return any(term in text for term in crisis_terms)

    @staticmethod
    def detect_academic_stress(message: str) -> bool:
        if not message:
            return False
        text = message.lower()
        terms = ["exam", "exams", "grades", "assignment", "deadline", "semester", "study", "college"]
        return any(term in text for term in terms)

    @classmethod
    def get_appropriate_personality(cls, message: str) -> str:
        # Pick a personality based on very simple cues; default to current
        if cls.detect_academic_stress(message):
            return "CBT"
        return cls.CURRENT_PERSONALITY

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


class SignUpRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None
    roll_number: Optional[str] = None
    institute_name: Optional[str] = None

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
    """Create a MindCareAI prompt with conversation history."""
    
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

MindCareAI:"""
    else:
        enhanced_prompt = f"""{system_prompt}

User: {user_message}

MindCareAI:"""
    
    return enhanced_prompt


async def send_verification_email(smtp_host, smtp_port, smtp_user, smtp_pass, from_addr, to_addr, full_name, token, frontend_url):
    """Send a verification email with a one-time token using SMTP (blocking call run in executor)."""
    verify_link = f"{frontend_url.rstrip('/')}/verify-email?token={token}"
    subject = "Verify your MindCare account"
    body = f"Hi {full_name or 'there'},\n\nPlease verify your MindCare account by clicking the link below:\n\n{verify_link}\n\nIf you didn't request this, you can ignore this email.\n\nThanks,\nMindCare Team"

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = to_addr
    msg.set_content(body)

    # Use blocking smtplib inside threadpool
    loop = asyncio.get_event_loop()
    def _send():
        port = int(smtp_port)
        if port == 465:
            # SMTPS (implicit SSL)
            with smtplib.SMTP_SSL(smtp_host, port) as server:
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
        else:
            # SMTP with STARTTLS
            with smtplib.SMTP(smtp_host, port) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)

    await loop.run_in_executor(None, _send)


@app.post("/signup")
async def signup(request: Request, signup: SignUpRequest, background_tasks: BackgroundTasks):
    """Create a new user via Supabase admin REST API (service role) and send verification email via SMTP.

    Expects environment variables in backend/.env (example provided):
    - SUPABASE_URL
    - SUPABASE_SERVICE_ROLE_KEY
    - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    - FRONTEND_URL (to build the verification link)
    """
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SERVICE_ROLE = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    # Debug: masked presence
    def _mask(s):
        if not s:
            return None
        return s[:6] + '...' + str(len(s))
    print(f"[/signup] SUPABASE_URL set={bool(SUPABASE_URL)}, SUPABASE_SERVICE_ROLE_KEY={_mask(SERVICE_ROLE)}")
    if not SUPABASE_URL or not SERVICE_ROLE:
        print("[/signup] Missing SUPABASE_URL or SERVICE_ROLE at request time")
        raise HTTPException(status_code=500, detail="Supabase service role not configured on server")

    # Create auth user via Supabase Admin REST API
    auth_endpoint = f"{SUPABASE_URL.rstrip('/')}/auth/v1/admin/users"
    headers = {
        'apikey': SERVICE_ROLE,
        'Authorization': f'Bearer {SERVICE_ROLE}',
        'Content-Type': 'application/json'
    }
    payload = {
        'email': signup.email,
        'password': signup.password,
        'email_confirm': True  # we will still send our own verification flow if desired
    }

    try:
        resp = requests.post(auth_endpoint, headers=headers, json=payload, timeout=20)
        resp.raise_for_status()
    except requests.exceptions.RequestException as e:
        # Log response text if available for debugging
        try:
            body = e.response.text if getattr(e, 'response', None) else None
            print(f"[/signup] Supabase admin API error: {body}")
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Error creating auth user: {str(e)}")

    user_data = resp.json()
    user_id = user_data.get('id')
    if not user_id:
        raise HTTPException(status_code=500, detail=f"Supabase did not return user id: {user_data}")

    # Insert profile row into public.users using service role REST endpoint
    # We use the REST table endpoint to upsert the profile with the service role key
    table_endpoint = f"{SUPABASE_URL.rstrip('/')}/rest/v1/users"
    profile = {
        'id': user_id,
        'email': signup.email,
        'full_name': signup.full_name,
        'roll_number': signup.roll_number,
        'institute_name': signup.institute_name,
        'created_at': datetime.utcnow().isoformat() + 'Z',
        'updated_at': datetime.utcnow().isoformat() + 'Z'
    }

    try:
        resp2 = requests.post(table_endpoint, headers=headers, json=profile, timeout=20)
        # Supabase REST upsert may require Prefer header for returning representation
        if resp2.status_code not in (200, 201):
            # Try with upsert using 'Prefer: return=representation'
            headers2 = headers.copy()
            headers2['Prefer'] = 'return=representation'
            resp2 = requests.post(table_endpoint, headers=headers2, json=profile, timeout=20)
            if resp2.status_code not in (200,201):
                raise HTTPException(status_code=500, detail=f"Error inserting profile: {resp2.status_code} {resp2.text}")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error inserting profile: {str(e)}")

    # Generate verification token and schedule an email (even if email_confirm True above)
    token = str(uuid.uuid4())
    expires_at = (datetime.utcnow() + timedelta(hours=24)).isoformat() + 'Z'

    # Store token fields using REST upsert
    token_payload = {
        'id': user_id,
        'email_verification_token': token,
        'token_expires_at': expires_at
    }
    try:
        headers3 = headers.copy()
        headers3['Prefer'] = 'return=representation'
        resp3 = requests.patch(f"{table_endpoint}?id=eq.{user_id}", headers=headers3, json=token_payload, timeout=20)
        if resp3.status_code not in (200,204):
            # fallback to post
            resp3 = requests.post(table_endpoint, headers=headers3, json=token_payload, timeout=20)
    except requests.exceptions.RequestException as e:
        # Not critical: continue but warn
        print("Warning: could not store token:", e)

    # Prepare SMTP send via background task
    smtp_host = os.getenv('SMTP_HOST')
    smtp_port = os.getenv('SMTP_PORT')
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    smtp_from = os.getenv('SMTP_FROM') or smtp_user
    frontend_url = os.getenv('FRONTEND_URL') or 'http://localhost:8080'

    if smtp_host and smtp_port and smtp_user and smtp_pass:
        background_tasks.add_task(send_verification_email, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, signup.email, signup.full_name, token, frontend_url)
    else:
        print("SMTP not configured; skipping verification email send")

    return {"status": "ok", "user_id": user_id}

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
            "message": "New conversation started! I'm MindCareAI, here to support you through your thoughts and emotions.",
            "personality": "MindCareAI",
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
        
    # AI PROCESSING STEP: Send to Ollama with MindCareAI parameters
        ollama_url = "http://localhost:11434/api/generate"
        payload = {
            "model": "gemma3:latest",
            "prompt": enhanced_prompt,
            # Enable streaming from Ollama - we'll consume line-delimited JSON chunks
            "stream": True,
            "options": TherapyAssistant.OLLAMA_PARAMETERS
        }

        # Use streamed request so we can relay partial outputs as they arrive.
        # Keep a non-stream fallback in case the server doesn't support streaming.
        try:
            resp = requests.post(ollama_url, json=payload, timeout=120, stream=True)
            resp.raise_for_status()

            # Ollama streams line-delimited JSON objects. We'll iterate and
            # concatenate any `response`/`content` fields we find. If the
            # server returns plain text lines, we'll append them as well.
            ai_parts = []
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                # Try to parse JSON chunk
                try:
                    chunk = json.loads(raw_line)
                except Exception:
                    # Not JSON, treat as plain text
                    ai_parts.append(raw_line)
                    continue

                # Common keys: 'response', 'content', 'delta'
                if isinstance(chunk, dict):
                    # 'response' may contain the full text in some endpoints
                    if 'response' in chunk and isinstance(chunk['response'], str):
                        ai_parts.append(chunk['response'])
                    # 'content' may be used for incremental tokens
                    elif 'content' in chunk and isinstance(chunk['content'], str):
                        ai_parts.append(chunk['content'])
                    # 'delta' may carry incremental pieces
                    elif 'delta' in chunk:
                        delta = chunk['delta']
                        if isinstance(delta, str):
                            ai_parts.append(delta)
                        elif isinstance(delta, dict):
                            # e.g., {'content': 'text'}
                            content = delta.get('content') or delta.get('response')
                            if isinstance(content, str):
                                ai_parts.append(content)

            ai_response = "".join(ai_parts).strip()

            # If streaming produced no output, attempt a non-streamed fallback
            if not ai_response:
                # Fallback: request without streaming
                payload['stream'] = False
                fallback = requests.post(ollama_url, json=payload, timeout=60)
                fallback.raise_for_status()
                data = fallback.json()
                ai_response = data.get('response', '') or data.get('content', '')
                ai_response = ai_response.strip() if isinstance(ai_response, str) else ''
        except requests.exceptions.RequestException:
            # If streaming request failed entirely, attempt a normal blocking call
            payload['stream'] = False
            response = requests.post(ollama_url, json=payload, timeout=60)
            response.raise_for_status()
            data = response.json()
            ai_response = data.get("response", "") or data.get('content', '')
            ai_response = ai_response.strip() if isinstance(ai_response, str) else ''
        if not ai_response:
            ai_response = "I apologize, but I couldn't generate a proper response. Please try again."
        
        # CONVERSATION STEP 4: Store AI response
        conversation_manager.add_message(session_id, "assistant", ai_response)
        
        # SUCCESS RESPONSE
        return {
            "response": ai_response,
            "session_id": session_id,
            "message_count": conversation_manager.get_session_info(session_id)["message_count"],
            "personality": "MindCareAI",
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


@app.post("/ai-chat")
async def ai_chat_stream(request: Request, chat: ChatRequest):
    """
    Streamed chat endpoint using Server-Sent Events (SSE).
    This proxies Ollama's streaming output and sends token/chunk updates
    to the client as SSE `data:` events (one event per chunk).
    """
    try:
        # Security & validation (reuse existing checks)
        client_ip = get_client_ip(request)
        is_allowed, rate_error = rate_limiter.is_allowed(client_ip)
        if not is_allowed:
            return error_handler.rate_limit_error(rate_error)

        is_valid, validation_error = input_validator.validate_message(chat.message)
        if not is_valid:
            return error_handler.validation_error(validation_error)

        clean_message = input_validator.sanitize_message(chat.message)

        session_id = chat.session_id or conversation_manager.create_session()
        if session_id:
            is_valid_session, session_error = input_validator.validate_session_id(session_id)
            if not is_valid_session:
                return error_handler.validation_error(session_error)

        # Build enhanced prompt
        enhanced_prompt = create_enhanced_prompt(session_id, clean_message)
        conversation_manager.add_message(session_id, "user", clean_message)

        ollama_url = "http://localhost:11434/api/generate"
        payload = {
            "model": "gemma3:latest",
            "prompt": enhanced_prompt,
            "stream": True,
            "options": TherapyAssistant.OLLAMA_PARAMETERS
        }

        def event_stream():
            # Try the streaming request
            try:
                with requests.post(ollama_url, json=payload, stream=True, timeout=120) as resp:
                    resp.raise_for_status()
                    for raw_line in resp.iter_lines(decode_unicode=True):
                        if not raw_line:
                            continue
                        # Try parse JSON
                        text_piece = None
                        try:
                            chunk = json.loads(raw_line)
                        except Exception:
                            text_piece = raw_line

                        if text_piece is None:
                            # Extract common fields
                            if isinstance(chunk, dict):
                                if 'response' in chunk and isinstance(chunk['response'], str):
                                    text_piece = chunk['response']
                                elif 'content' in chunk and isinstance(chunk['content'], str):
                                    text_piece = chunk['content']
                                elif 'delta' in chunk:
                                    delta = chunk['delta']
                                    if isinstance(delta, str):
                                        text_piece = delta
                                    elif isinstance(delta, dict):
                                        text_piece = delta.get('content') or delta.get('response')

                        if not text_piece:
                            continue

                        # Yield as SSE data field (client will receive incrementally)
                        # Each chunk is sent as a single 'data:' event
                        yield f"data: {text_piece}\n\n"

            except requests.exceptions.RequestException as e:
                # On error, send an SSE event with the error message
                yield f"event: error\ndata: {str(e)}\n\n"

            # Signal end of stream
            yield "event: done\ndata: [DONE]\n\n"

        # Return StreamingResponse with correct SSE media type
        return StreamingResponse(event_stream(), media_type="text/event-stream")

    except Exception as e:
        return error_handler.server_error(f"Streaming chat failed: {str(e)}")

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
            "personality": TherapyAssistant.CURRENT_PERSONALITY,
            "status": "success"
        }
    except Exception as e:
        return error_handler.server_error(f"Failed to retrieve conversation: {str(e)}")

# ===============================================================================
# API ENDPOINTS - PERSONALITY MANAGEMENT
# ===============================================================================
@app.get("/personality")
async def get_current_personality():
    """Get information about the current therapy assistant configuration and available therapeutic approaches."""
    return {
        "current_personality": TherapyAssistant.CURRENT_PERSONALITY,
        "available_personalities": list(TherapyAssistant.THERAPY_PERSONALITIES.keys()),
        "description": TherapyAssistant.THERAPY_PERSONALITIES[TherapyAssistant.CURRENT_PERSONALITY],
        "therapeutic_focus": "College student mental health support and professional referrals",
        "status": "success"
    }

@app.post("/personality")
async def update_personality(request: PersonalityUpdateRequest):
    """
    Change the therapy assistant's therapeutic approach. This affects the default approach for new conversations.
    The system still dynamically selects the most appropriate approach based on message content.
    """
    try:
        if request.personality not in TherapyAssistant.THERAPY_PERSONALITIES:
            available = list(TherapyAssistant.THERAPY_PERSONALITIES.keys())
            return error_handler.validation_error(f"Invalid therapeutic approach. Available options: {available}")
        
        old_personality = TherapyAssistant.CURRENT_PERSONALITY
        TherapyAssistant.CURRENT_PERSONALITY = request.personality
        
        return {
            "message": f"Default therapeutic approach updated from '{old_personality}' to '{request.personality}'",
            "new_personality": request.personality,
            "description": TherapyAssistant.THERAPY_PERSONALITIES[request.personality],
            "note": "System still dynamically selects approach based on message content",
            "status": "success"
        }
    except Exception as e:
        return error_handler.server_error(f"Failed to update therapeutic approach: {str(e)}")

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
            "current_personality": TherapyAssistant.CURRENT_PERSONALITY,
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

# ===============================================================================
# API ENDPOINTS - THERAPY-SPECIFIC FEATURES
# ===============================================================================
@app.post("/crisis-check")
async def crisis_check(request: CrisisCheckRequest):
    """
    Check if a message contains crisis indicators for immediate intervention.
    This endpoint can be used for pre-screening or admin monitoring.
    """
    try:
        is_crisis = TherapyAssistant.detect_crisis(request.message)
        is_academic_stress = TherapyAssistant.detect_academic_stress(request.message)
        recommended_approach = TherapyAssistant.get_appropriate_personality(request.message)
        
        return {
            "message": request.message[:100] + "..." if len(request.message) > 100 else request.message,
            "crisis_detected": is_crisis,
            "academic_stress_detected": is_academic_stress,
            "recommended_approach": recommended_approach,
            "urgent_referral_needed": is_crisis,
            "status": "success"
        }
    except Exception as e:
        return error_handler.server_error(f"Failed to perform crisis check: {str(e)}")

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
