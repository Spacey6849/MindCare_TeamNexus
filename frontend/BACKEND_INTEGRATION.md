# TheraBot Frontend-Backend Integration

This document describes how the new frontend connects to the existing TheraBot backend API.

## Backend Connection Overview

The new frontend in `c:\VS CODE\SIH_Joel\new_frontend` has been updated to connect to the existing TheraBot backend server running on `http://127.0.0.1:8000`.

## Updated Components

### 1. AIChat Component (`src/components/AIChat.tsx`)
- **Updated**: Added full backend integration with session management
- **Features**:
  - Connects to `/chat` endpoint for real AI responses
  - Maintains conversation sessions with UUID generation
  - Handles loading states and error handling
  - Supports both manual messages and quick actions

### 2. API Configuration (`src/lib/api.ts`)
- **New**: Centralized API configuration and helper functions
- **Features**:
  - Centralized endpoint configuration
  - Type-safe request/response interfaces
  - Helper class `TherabotAPI` with methods:
    - `sendMessage(message, sessionId)` - Send chat messages
    - `createNewSession()` - Create new conversation sessions
    - `getStatus()` - Check server status
    - `getResources()` - Fetch mental health resources

### 3. Backend Resources Page (`src/pages/BackendResourcesPage.tsx`)
- **New**: Component to display backend mental health resources
- **Features**:
  - Fetches resources from `/resources` endpoint
  - Displays emergency contacts, college resources, online resources
  - Shows self-care tips and "when to seek help" information
  - Includes loading states and error handling

### 4. Backend Status Checker (`src/components/BackendStatusChecker.tsx`)
- **New**: Real-time backend connectivity checker
- **Features**:
  - Checks `/status` endpoint to verify server connectivity
  - Shows server status, version, and connection health
  - Includes refresh functionality

## Backend API Endpoints Used

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/chat` | POST | Main chat functionality | ✅ Integrated |
| `/new-session` | POST | Create new conversation session | ✅ Available |
| `/status` | GET | Server health check | ✅ Integrated |
| `/resources` | GET | Mental health resources | ✅ Integrated |
| `/conversation/{session_id}` | GET | Get conversation history | ⚠️ Not used yet |
| `/personality` | GET/POST | Get/set bot personality | ⚠️ Not used yet |
| `/crisis-check` | POST | Crisis detection | ⚠️ Not used yet |

## Request/Response Format

### Chat Request
```typescript
{
  message: string;
  session_id?: string;
}
```

### Chat Response
```typescript
{
  response: string;
  session_id: string;
  personality?: string;
  status: string;
  timestamp?: string;
}
```

## Installation & Setup

### 1. Install Dependencies
```bash
cd c:\VS CODE\SIH_Joel\new_frontend
npm install
```

### 2. Start Backend Server
Use the new batch file:
```bash
c:\VS CODE\SIH_Joel\bat\start_therabot_new.bat
```

Or manually:
```bash
# Terminal 1: Start Ollama
ollama serve

# Terminal 2: Start Backend API
cd c:\VS CODE\SIH_Joel
.\sih\Scripts\Activate
uvicorn chatbot:app --reload --host 127.0.0.1 --port 8000

# Terminal 3: Start New Frontend
cd c:\VS CODE\SIH_Joel\new_frontend
npm run dev
```

### 3. Access the Application
- Frontend: http://127.0.0.1:8080
- Backend API: http://127.0.0.1:8000
- API Docs: http://127.0.0.1:8000/docs

## CORS Configuration

The backend is already configured to allow requests from:
- `http://localhost:8080`
- `http://127.0.0.1:8080`
- `http://localhost:3000`

## Error Handling

All API calls include proper error handling:
- Network errors show user-friendly messages
- Timeout handling for slow responses
- Fallback messages when API is unavailable
- Loading states during API calls

## Session Management

- Each chat session gets a unique UUID
- Session IDs are maintained throughout the conversation
- Backend handles conversation memory automatically

## Security Features

The backend includes:
- Rate limiting (handled automatically)
- Input validation (handled by backend)
- CORS protection
- Error handling without exposing internal details

## Next Steps

1. ✅ Basic chat integration completed
2. ⚠️ Add conversation history retrieval
3. ⚠️ Implement personality switching
4. ⚠️ Add crisis detection integration
5. ⚠️ Add authentication/user management
6. ⚠️ Add booking system backend integration
7. ⚠️ Add admin dashboard backend integration

## Testing

To verify the integration works:

1. Start all services using the batch file
2. Open http://127.0.0.1:8080
3. Navigate to the AI Chat section
4. Send a test message
5. Verify you receive an AI response from the backend

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Ensure backend allows the frontend origin
2. **Connection Refused**: Check if backend server is running on port 8000
3. **Ollama Errors**: Ensure Ollama service is running with appropriate models
4. **Session Issues**: Check browser console for session ID generation

### Debug Steps:

1. Check backend status at http://127.0.0.1:8000/status
2. View API documentation at http://127.0.0.1:8000/docs
3. Check browser network tab for failed requests
4. Verify backend logs for errors

## File Structure

```
new_frontend/
├── src/
│   ├── components/
│   │   ├── AIChat.tsx (✅ Updated)
│   │   └── BackendStatusChecker.tsx (✅ New)
│   ├── pages/
│   │   └── BackendResourcesPage.tsx (✅ New)
│   └── lib/
│       └── api.ts (✅ New)
└── ...
```

This integration maintains the same functionality as the old frontend while providing a cleaner, more maintainable codebase with proper TypeScript types and centralized API management.