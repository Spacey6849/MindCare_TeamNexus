# MindCare - AI-Powered Mental Health Support Platform

**A comprehensive mental health support ecosystem designed specifically for educational institutions, combining AI therapy assistance with professional counseling and peer support systems.**

## Overview

TheraBot is an advanced mental health platform that addresses the growing crisis of student psychological wellbeing in educational institutions. The platform provides 24/7 AI-powered therapy assistance, professional counseling booking systems, moderated peer support communities, and comprehensive mental health resources.

## Key Features

### AI Mental Health Companion

- **24/7 Availability**: Immediate therapeutic support using advanced AI technology
- **Conversation Memory**: Multi-session continuity with complete conversation history
- **Crisis Detection**: Automatic identification of mental health emergencies with immediate intervention protocols
- **Therapeutic Approaches**: Dynamic personality switching based on conversation context and user needs
- **Human-like Interaction**: Natural, empathetic conversations with therapeutic validation techniques

### Professional Integration

- **Counselor Booking System**: Calendar-based appointment scheduling with certified mental health professionals
- **Session Management**: Secure communication channels compliant with healthcare privacy standards
- **AI-to-Human Transition**: Seamless handoff from AI support to professional counseling when needed
- **Resource Provision**: Comprehensive mental health resources and emergency contact information

### Peer Support Community

- **Moderated Forums**: Safe spaces for student interaction with trained volunteer oversight
- **Anonymous Participation**: Reduced stigma through optional anonymity features
- **Trained Peer Helpers**: Student volunteer network providing immediate community support
- **Response Time Management**: Average response time under 2 hours for peer assistance

### Administrative Control

- **Analytics Dashboard**: Platform engagement metrics and mental health trend analysis
- **User Management**: Complete user lifecycle administration with role-based access control
- **Content Moderation**: Automated and manual content review systems with community guideline enforcement
- **Crisis Monitoring**: Real-time crisis intervention tracking and reporting capabilities

## Technical Architecture

### Backend (Python FastAPI)

- **AI Integration**: Local Ollama deployment with Gemma3:4b model for complete data privacy
- **Conversation Management**: UUID-based session system with persistent conversation memory
- **Security Framework**: Multi-layer input validation, rate limiting, and crisis detection protocols
- **API Endpoints**: RESTful API design with comprehensive error handling and status monitoring

### Frontend (React TypeScript)

- **Modern Interface**: Responsive design with Tailwind CSS and component-based architecture
- **Real-time Communication**: WebSocket integration for immediate AI responses and status updates
- **Multi-role Support**: Separate interfaces for students, counselors, administrators, and peer helpers
- **Accessibility**: WCAG-compliant design ensuring accessibility for users with disabilities

## Installation and Setup

### Prerequisites

**System Requirements:**

- Python 3.10 or higher
- Node.js 18 or higher
- 8GB RAM minimum (16GB recommended)
- 10GB available storage space

**Required Software:**

- Git for repository management
- Ollama AI engine for local model deployment

### Step 1: Repository Setup

```bash
git clone https://github.com/yourusername/TheraBot.git
cd TheraBot
```

### Step 2: Backend Installation

```bash
cd backend
python -m venv therabot_env
source therabot_env/bin/activate  # On Windows: therabot_env\Scripts\activate
pip install -r requirements.txt
```

### Step 3: AI Model Setup

**Install Ollama:**

- Download from: https://ollama.ai/
- Follow installation instructions for your operating system

**Download AI Model:**

```bash
ollama pull gemma3:4b
```

### Step 4: Frontend Installation

```bash
cd ../frontend
npm install
```

### Step 5: Configuration

**Backend Configuration:**

- Review CORS settings in `backend/chatbot.py`
- Adjust rate limiting parameters in `backend/security.py`
- Configure therapeutic prompts in `backend/chatbot.py`

**Frontend Configuration:**

- Update API endpoints in `frontend/src/lib/api.ts`
- Configure environment variables in `frontend/.env`

### Environment files (important)

- Frontend (`frontend/.env`): must contain only browser-safe values. Example:

```
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-public-key>
```

- Backend (`backend/.env`): must contain server-only secrets. Copy `backend/.env.example` to `backend/.env` and fill it. It should include:

```
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
SMTP_USER=<your-smtp-user>
SMTP_PASS=<your-smtp-password>
```

Never commit service-role or SMTP credentials to the frontend or the repository.

## Running the Application

### Development Environment

**Terminal 1 - Start AI Service:**

```bash
ollama serve
```

**Terminal 2 - Start Backend:**

```bash
cd backend
source therabot_env/bin/activate  # On Windows: therabot_env\Scripts\activate
uvicorn chatbot:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 3 - Start Frontend:**

```bash
cd frontend
npm run dev
```

**Access the Application:**

- Frontend Interface: http://localhost:8080
- Backend API Documentation: http://localhost:8000/docs
- AI Service Status: http://localhost:11434

### Production Deployment

**Database Migration:**
For production environments, migrate from in-memory storage to persistent database:

- PostgreSQL for conversation history
- Redis for session management
- Implement proper backup and recovery systems

**Security Enhancements:**

- Configure SSL/TLS certificates
- Implement proper authentication systems
- Set up monitoring and logging infrastructure
- Configure firewall and network security

**Scalability Considerations:**

- Load balancing for multiple concurrent users
- Horizontal scaling for high availability
- Content delivery network for static assets
- Database optimization for large user bases

## Usage Guide

### For Students

1. **Registration**: Create account with institutional email address
2. **AI Chat**: Access immediate therapeutic support through conversation interface
3. **Appointment Booking**: Schedule sessions with certified counselors
4. **Community Participation**: Engage in moderated peer support forums
5. **Resource Access**: Browse curated mental health educational content

### For Administrators

1. **Dashboard Access**: Monitor platform engagement and mental health trends
2. **User Management**: Oversee student, counselor, and peer helper accounts
3. **Content Moderation**: Review and manage community forum content
4. **Crisis Management**: Track and respond to mental health emergencies
5. **System Configuration**: Adjust AI behavior and platform settings

### For Counselors

1. **Professional Dashboard**: Manage appointment schedules and client communications
2. **AI Integration**: Review AI conversation summaries for informed sessions
3. **Resource Management**: Update and maintain mental health resource libraries
4. **Crisis Response**: Participate in emergency intervention protocols

## API Documentation

### Core Endpoints

**Chat Operations:**

- `POST /chat` - Send message to AI therapist
- `POST /new-session` - Create new conversation session
- `GET /conversation/{session_id}` - Retrieve conversation history

**System Management:**

- `GET /status` - System health and statistics
- `GET /resources` - Mental health resources and emergency contacts
- `POST /crisis-check` - Check message for crisis indicators

**Authentication:**

- `POST /login` - User authentication
- `POST /logout` - Session termination
- `GET /user/profile` - User profile information

### Response Format

All API responses follow standardized JSON format:

```json
{
  "status": "success|error",
  "message": "Response message",
  "data": {},
  "timestamp": "ISO timestamp"
}
```

## Security and Privacy

### Data Protection

- **Local AI Processing**: All therapeutic conversations processed locally without external transmission
- **Encrypted Communication**: End-to-end encryption for all sensitive data transmission
- **Session Security**: UUID-based session management with automatic expiration
- **Input Validation**: Comprehensive sanitization preventing malicious input injection

### Compliance Standards

- **HIPAA Ready**: Architecture supports healthcare privacy requirements
- **FERPA Compliant**: Educational record privacy protection protocols
- **GDPR Compatible**: European data protection regulation compliance
- **Institutional Policies**: Customizable to meet specific organizational requirements

### Crisis Protocols

- **Automatic Detection**: Real-time analysis for suicide ideation and self-harm indicators
- **Immediate Escalation**: Direct connection to crisis hotlines and emergency services
- **Professional Notification**: Automated alerts to designated counseling staff
- **Follow-up Procedures**: Systematic check-in protocols for at-risk individuals

## Contributing

### Development Guidelines

- **Code Standards**: Follow PEP 8 for Python, ESLint configuration for TypeScript
- **Testing Requirements**: Comprehensive unit tests for all new features
- **Documentation**: Detailed documentation for API changes and new functionality
- **Security Review**: All contributions undergo security assessment before integration

### Contribution Process

1. Fork the repository and create feature branch
2. Implement changes with appropriate testing coverage
3. Update documentation for any API or functionality changes
4. Submit pull request with detailed description of changes
5. Participate in code review process and address feedback

## Support and Resources

### Technical Support

- **Documentation**: Comprehensive guides for installation, configuration, and usage
- **Issue Tracking**: GitHub Issues for bug reports and feature requests
- **Community Forum**: Developer and user community for questions and best practices
- **Professional Support**: Available for institutional implementations

### Training Resources

- **Administrator Guide**: Complete platform management training materials
- **Counselor Integration**: Professional guidance for therapeutic staff
- **Peer Helper Training**: Comprehensive volunteer preparation program
- **User Tutorials**: Step-by-step guides for student users

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Mental Health Professionals**: Expert guidance on therapeutic approaches and crisis intervention
- **Educational Institutions**: Partnership in understanding student mental health needs
- **Open Source Community**: Contributions to underlying technologies and frameworks
- **Research Organizations**: Academic research supporting evidence-based therapeutic techniques

## Contact Information

For institutional implementation inquiries, technical support, or partnership opportunities, please contact the development team through the repository issue system or official project communications channels.

---

**Disclaimer**: TheraBot is designed to supplement, not replace, professional mental health services. Users experiencing severe mental health crises should immediately contact emergency services or qualified mental health professionals. This platform provides supportive resources and should not be considered a substitute for professional therapeutic intervention.
