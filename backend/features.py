# Import necessary modules
from typing import List, Dict, Optional  # For type hints to make code clearer
from datetime import datetime  # To timestamp messages
import uuid  # To generate unique session IDs
from dataclasses import dataclass  # Makes creating simple classes easier

# This decorator automatically creates __init__, __repr__, and other methods
@dataclass
class MessageData:
    """
    Represents a single message in a conversation.
    Using @dataclass eliminates the need to write __init__ manually.
    """
    role: str      # Either "user" or "assistant" - who sent the message
    content: str   # The actual message text
    timestamp: datetime  # When the message was created
    
    # This method runs automatically when creating a new MessageData
    def __post_init__(self):
        # If no timestamp provided, use current time
        if not hasattr(self, 'timestamp') or self.timestamp is None:
            self.timestamp = datetime.now()

class ConversationManager:
    """
    Manages all conversations in memory.
    Each conversation is identified by a unique session_id.
    """
    
    def __init__(self):
        # Dictionary to store all conversations
        # Key: session_id (string), Value: list of MessageData objects
        self.conversations: Dict[str, List[MessageData]] = {}
        print("ConversationManager initialized - ready to store conversations!")
    
    def create_session(self) -> str:
        """
        Creates a new conversation session with a unique ID.
        Returns: A unique session ID string
        """
        # Generate a random unique identifier
        session_id = str(uuid.uuid4())
        
        # Initialize empty conversation for this session
        self.conversations[session_id] = []
        
        print(f"New session created: {session_id}")
        return session_id
    
    def add_message(self, session_id: str, role: str, content: str) -> bool:
        """
        Adds a new message to an existing conversation.
        
        Args:
            session_id: The conversation to add to
            role: "user" or "assistant" 
            content: The message text
            
        Returns:
            True if successful, False if session doesn't exist
        """
        # Check if the session exists
        if session_id not in self.conversations:
            print(f"Session {session_id} not found!")
            return False
        
        # Create a new message with current timestamp
        message = MessageData(
            role=role,
            content=content,
            timestamp=datetime.now()
        )
        
        # Add the message to the conversation
        self.conversations[session_id].append(message)
        
        print(f"Message added to session {session_id}: {role} - {content[:50]}...")
        return True
    
    def get_conversation_history(self, session_id: str) -> List[Dict]:
        """
        Gets the conversation history formatted for the AI model.
        
        Args:
            session_id: Which conversation to retrieve
            
        Returns:
            List of dictionaries in format AI models expect
        """
        # Check if session exists
        if session_id not in self.conversations:
            print(f"Session {session_id} not found!")
            return []
        
        # Convert our MessageData objects to dictionaries the AI can understand
        history = []
        for message in self.conversations[session_id]:
            history.append({
                "role": message.role,
                "content": message.content
            })
        
        print(f"Retrieved {len(history)} messages from session {session_id}")
        return history
    
    def get_session_info(self, session_id: str) -> Dict:
        """
        Gets information about a specific session.
        
        Returns:
            Dictionary with session stats
        """
        if session_id not in self.conversations:
            return {"exists": False, "message_count": 0}
        
        return {
            "exists": True,
            "message_count": len(self.conversations[session_id]),
            "created": True  # In a real app, you'd track creation time
        }
    
    def list_all_sessions(self) -> List[str]:
        """
        Returns a list of all active session IDs.
        Useful for debugging or admin purposes.
        """
        return list(self.conversations.keys())

# Create a global instance that will be shared across the application
# This stays in memory as long as the server is running
conversation_manager = ConversationManager()

# Helper function to format conversation for Ollama
def format_conversation_for_ollama(session_id: str, new_message: str) -> str:
    """
    Formats the conversation history plus new message for sending to Ollama.
    
    Args:
        session_id: Which conversation to include
        new_message: The new user message
        
    Returns:
        A formatted string with conversation context
    """
    # Get the conversation history
    history = conversation_manager.get_conversation_history(session_id)
    
    # Start building the prompt with context
    prompt_parts = []
    
    # Add previous messages as context
    if history:
        prompt_parts.append("Previous conversation:")
        for msg in history[-10:]:  # Only include last 10 messages to avoid too long prompts
            if msg["role"] == "user":
                prompt_parts.append(f"User: {msg['content']}")
            else:
                prompt_parts.append(f"Assistant: {msg['content']}")
        
        prompt_parts.append("\nCurrent message:")
    
    # Add the new message
    prompt_parts.append(f"User: {new_message}")
    
    # Join everything together
    full_prompt = "\n".join(prompt_parts)
    
    print(f"Formatted prompt with {len(history)} previous messages")
    return full_prompt