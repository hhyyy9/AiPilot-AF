<!-- markdownlint-disable MD047 -->

# AiPilot-AF

## Description
AiPilot-AF is an AI-powered development assistant platform that integrates Azure's cloud services with a modern mobile application. The project consists of two main components:
- Frontend: [AiPilot](https://github.com/hhyyy9/AiPilot) - A React Native mobile application
- Backend: AiPilot-AF - Azure Functions-based backend services

The platform provides intelligent coding assistance, automated development workflows, and seamless integration with Azure's AI and cloud services.

## Technology Stack
### Frontend ([AiPilot](https://github.com/hhyyy9/AiPilot))
#### Framework & Platform
- React Native (v0.74.5)
- Expo (v51.0.34)
- React (v18.2.0)

#### Navigation & Routing
- Expo Router
- React Navigation (v6.1.18)

#### State Management
- MobX (v6.13.3)
- MobX React Lite (v4.0.7)

#### UI Components & Design
- Ant Design React Native (v5.2.3)
- Expo Vector Icons

#### API & Network
- Axios (v1.7.7)
- OpenAI SDK (v4.65.0)

#### Storage & Data
- AsyncStorage

#### Internationalization
- i18next (v23.16.0)
- react-i18next (v15.0.3)

#### Development & Build Tools
- TypeScript
- Babel
- Jest (testing)
- Expo Dev Client

#### Native Features
- expo-av (Audio/Video)
- expo-document-picker
- expo-speech-recognition
- expo-splash-screen
- expo-status-bar
- expo-web-browser

#### Platform Support
- iOS
- Android

### Backend (AiPilot-AF)
#### Core Platform
- .NET 6.0
- Azure Functions v4
- C# 10.0

#### Azure Services
- Azure OpenAI Service
  - GPT-4 Models
  - Embeddings
- Azure Cognitive Services
  - Speech Services
  - Language Understanding
- Azure Key Vault
- Azure Blob Storage
- Azure Cosmos DB
- Azure Application Insights

#### Authentication & Security
- Azure Active Directory B2C
- JWT Token Authentication
- Azure Key Vault for Secrets Management

#### Development Tools
- Visual Studio 2022
- Azure Functions Core Tools
- Azure CLI

## Features
- 🤖 AI-Powered Development
  - Code generation and completion using Azure OpenAI
  - Natural language to code conversion
  - Intelligent code suggestions and explanations
  - Voice-to-code using Speech Recognition

- 🔄 Development Workflow
  - Project scaffolding and boilerplate generation
  - Code review assistance
  - Documentation generation
  - Multi-language support

- 🛠 Developer Tools
  - Cross-platform mobile interface (iOS/Android)
  - Real-time code preview
  - Voice command support
  - Document scanning and code extraction

## Prerequisites
- .NET 6.0 SDK
- Node.js (v18.0.0 or higher)
- npm or yarn
- Expo CLI
- Azure subscription
- Azure CLI
- Visual Studio 2022 (for backend development)

## Installation

### Frontend Setup
```bash
# Clone the frontend repository
git clone https://github.com/hhyyy9/AiPilot.git
cd AiPilot

# Install dependencies
npm install
# or
yarn install

# Start Expo development server
npx expo start
```

### Backend Setup
```bash
# Clone the backend repository
git clone [your-backend-repo-url]
cd AiPilot-AF

# Configure Azure credentials
az login

# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Start Functions locally
func start
```

## Project Structure
```
AiPilot-AF/
├── src/
│   ├── Functions/           # Azure Functions
│   │   ├── OpenAI/         # OpenAI integration functions
│   │   ├── Speech/         # Speech recognition functions
│   │   └── Auth/          # Authentication functions
│   ├── Services/          # Business logic services
│   ├── Models/            # Data models
│   └── Config/            # Configuration files
├── Tests/                 # Test projects
├── Infrastructure/        # Azure infrastructure as code
├── local.settings.json   # Local settings
└── host.json             # Function host configuration
```

## Environment Variables
Create a `local.settings.json` file in the root directory:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "NODE_ENV": "development",
    "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://YOUR_COSMOS_ENDPOINT.documents.azure.com:443/;AccountKey=YOUR_COSMOS_ACCOUNT_KEY;",
    "COSMOS_ENDPOINT": "https://YOUR_COSMOS_ENDPOINT.azure.com:443/",
    "JWT_SECRET": "234234234k;l324ipo23434",
    "OPENAI_API_KEY": "YOUR_OPENAI_API_KEY",
    "STRIPE_SECRET_KEY": "YOUR_STRIPE_SECRET_KEY",
    "REFRESH_SECRET": "YOUR_REFRESH_SECRET"
  }
}
```

## Contributing
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects
- [AiPilot Frontend](https://github.com/hhyyy9/AiPilot) - The React Native mobile application

## Acknowledgments
- Microsoft Azure Cloud Services
- OpenAI for AI capabilities
- The open-source community for various tools and libraries used in this project
