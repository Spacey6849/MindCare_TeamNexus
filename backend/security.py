# ===============================================================================
# SECURITY.PY - INPUT VALIDATION AND ERROR HANDLING
# ===============================================================================
# This file handles:
# - Input validation (message length, content filtering)
# - Rate limiting (prevent spam/abuse)
# - Error handling utilities
# - Request sanitization
# ===============================================================================

from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import re
from collections import defaultdict, deque

# ===============================================================================
# RATE LIMITING SYSTEM
# ===============================================================================

class RateLimiter:
    """
    Simple in-memory rate limiter to prevent API abuse.
    Tracks requests per IP address and enforces limits.
    """
    
    def __init__(self, max_requests: int = 10, time_window: int = 60):
        """
        Initialize rate limiter.
        
        Args:
            max_requests: Maximum requests allowed per time window
            time_window: Time window in seconds (default: 60 seconds)
        """
        self.max_requests = max_requests
        self.time_window = time_window
        # Store timestamps of requests for each IP
        self.requests: Dict[str, deque] = defaultdict(deque)
        print(f"Rate limiter initialized: {max_requests} requests per {time_window} seconds")
    
    def is_allowed(self, client_ip: str) -> tuple[bool, Optional[str]]:
        """
        Check if a request from this IP is allowed.
        
        Args:
            client_ip: IP address of the client
            
        Returns:
            (is_allowed: bool, error_message: Optional[str])
        """
        now = datetime.now()
        client_requests = self.requests[client_ip]
        
        # Remove old requests outside the time window
        cutoff_time = now - timedelta(seconds=self.time_window)
        while client_requests and client_requests[0] < cutoff_time:
            client_requests.popleft()
        
        # Check if under the limit
        if len(client_requests) >= self.max_requests:
            return False, f"Rate limit exceeded. Max {self.max_requests} requests per {self.time_window} seconds."
        
        # Record this request
        client_requests.append(now)
        return True, None

# ===============================================================================
# INPUT VALIDATION
# ===============================================================================

class InputValidator:
    """
    Validates and sanitizes user input for security and quality.
    """
    
    def __init__(self):
        # Define limits and patterns
        self.MAX_MESSAGE_LENGTH = 1000
        self.MIN_MESSAGE_LENGTH = 1
        self.MAX_SESSION_ID_LENGTH = 100
        
        # Harmful patterns to detect (basic protection)
        self.HARMFUL_PATTERNS = [
            r'<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>',  # Script tags
            r'javascript:',  # JavaScript protocols
            r'vbscript:',    # VBScript protocols
            r'on\w+\s*=',    # Event handlers
        ]
        
        self.compiled_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in self.HARMFUL_PATTERNS]
        print("Input validator initialized with security patterns")
    
    def validate_message(self, message: str) -> tuple[bool, Optional[str]]:
        """
        Validate a chat message for length, content, and security.
        
        Args:
            message: The message to validate
            
        Returns:
            (is_valid: bool, error_message: Optional[str])
        """
        # Check if message exists
        if not message or not isinstance(message, str):
            return False, "Message must be a non-empty string"
        
        # Check message length
        if len(message) < self.MIN_MESSAGE_LENGTH:
            return False, f"Message too short (minimum {self.MIN_MESSAGE_LENGTH} character)"
        
        if len(message) > self.MAX_MESSAGE_LENGTH:
            return False, f"Message too long (maximum {self.MAX_MESSAGE_LENGTH} characters)"
        
        # Check for harmful content
        for pattern in self.compiled_patterns:
            if pattern.search(message):
                return False, "Message contains potentially harmful content"
        
        # Check for excessive repetition (spam detection)
        if self._is_spam_message(message):
            return False, "Message appears to be spam (excessive repetition)"
        
        return True, None
    
    def validate_session_id(self, session_id: str) -> tuple[bool, Optional[str]]:
        """
        Validate a session ID format and length.
        
        Args:
            session_id: The session ID to validate
            
        Returns:
            (is_valid: bool, error_message: Optional[str])
        """
        if not session_id or not isinstance(session_id, str):
            return False, "Session ID must be a non-empty string"
        
        if len(session_id) > self.MAX_SESSION_ID_LENGTH:
            return False, f"Session ID too long (maximum {self.MAX_SESSION_ID_LENGTH} characters)"
        
        # Check for valid UUID format (our session IDs are UUIDs)
        uuid_pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        if not re.match(uuid_pattern, session_id, re.IGNORECASE):
            return False, "Invalid session ID format"
        
        return True, None
    
    def _is_spam_message(self, message: str) -> bool:
        """
        Detect if a message is likely spam based on repetition patterns.
        
        Args:
            message: Message to check
            
        Returns:
            True if message appears to be spam
        """
        # Check for excessive character repetition
        if re.search(r'(.)\1{10,}', message):  # Same character 10+ times
            return True
        
        # Check for excessive word repetition
        words = message.split()
        if len(words) > 3:
            word_counts = {}
            for word in words:
                word_counts[word.lower()] = word_counts.get(word.lower(), 0) + 1
                if word_counts[word.lower()] > len(words) * 0.5:  # Word appears >50% of the time
                    return True
        
        return False
    
    def sanitize_message(self, message: str) -> str:
        """
        Clean and sanitize a message (basic cleanup).
        
        Args:
            message: Raw message
            
        Returns:
            Cleaned message
        """
        # Remove excessive whitespace
        message = re.sub(r'\s+', ' ', message.strip())
        
        # Remove null characters
        message = message.replace('\x00', '')
        
        return message

# ===============================================================================
# ERROR RESPONSE UTILITIES
# ===============================================================================

class ErrorHandler:
    """
    Standardized error response generator for consistent API responses.
    """
    
    @staticmethod
    def validation_error(message: str) -> Dict[str, Any]:
        """Generate standardized validation error response."""
        return {
            "error": "Validation Error",
            "message": message,
            "error_type": "validation",
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def rate_limit_error(message: str) -> Dict[str, Any]:
        """Generate standardized rate limit error response."""
        return {
            "error": "Rate Limit Exceeded",
            "message": message,
            "error_type": "rate_limit",
            "timestamp": datetime.now().isoformat(),
            "retry_after": 60  # Suggest retry after 60 seconds
        }
    
    @staticmethod
    def server_error(message: str) -> Dict[str, Any]:
        """Generate standardized server error response."""
        return {
            "error": "Server Error",
            "message": message,
            "error_type": "server",
            "timestamp": datetime.now().isoformat()
        }
    
    @staticmethod
    def session_error(message: str) -> Dict[str, Any]:
        """Generate standardized session error response."""
        return {
            "error": "Session Error",
            "message": message,
            "error_type": "session",
            "timestamp": datetime.now().isoformat()
        }

# ===============================================================================
# GLOBAL INSTANCES
# ===============================================================================

# Create global instances to be used across the application
rate_limiter = RateLimiter(max_requests=20, time_window=60)  # 20 requests per minute
input_validator = InputValidator()
error_handler = ErrorHandler()

print("Security module loaded successfully!")
print("- Rate limiter: 20 requests per 60 seconds")
print("- Input validator: Message length 1-1000 chars, spam detection enabled")
print("- Error handler: Standardized error responses")