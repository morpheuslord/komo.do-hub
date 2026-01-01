# Komodo Manager

## Overview

Komodo Manager is a mobile-first server management console for the Komodo build and deployment system. It provides a React-based interface for monitoring and controlling servers, containers, Docker stacks, builds, and repositories. The app is designed primarily for Android using Capacitor, but also runs as a web application.

The application connects to a self-hosted Komodo server via API credentials (URL, API key, and secret) and provides real-time monitoring of infrastructure resources.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React 18 with TypeScript** - Modern React with hooks and functional components
- **Vite** - Fast build tool and development server configured on port 5000
- **Path aliases** - Uses `@/` prefix mapped to `src/` directory

### UI Component Library
- **shadcn/ui** - Component library built on Radix UI primitives
- **Tailwind CSS** - Utility-first styling with CSS variables for theming
- **Lucide React** - Icon library
- Components located in `src/components/ui/` are shadcn primitives, while custom components are in `src/components/`

### State Management
- **TanStack React Query** - Server state management for API data fetching
- **React Context** - Used for authentication state (`AuthContext`) and theme management (`ThemeProvider`)
- **localStorage** - Persists credentials and user preferences

### Mobile Platform
- **Capacitor 8** - Native Android wrapper
- Configured in `capacitor.config.json` with app ID `com.komodo.app`
- Android-specific settings allow mixed content and cleartext for local network access
- Build output goes to `dist/` directory which Capacitor bundles

### Authentication Pattern
- Credentials stored in localStorage with XOR obfuscation (not encryption)
- Login flow: User provides Komodo server URL + API key + secret
- Client validates credentials by testing connection before storing
- Session persists until explicit logout

### API Integration
- Custom API client wrapper in `src/lib/komodo-api.ts`
- Interfaces with `komodo_client` npm package for Komodo server communication
- Supports read, write, and execute operations against Komodo API
- Resource types: Servers, Stacks, Deployments (containers), Builds, Repos

### Application Structure
- `src/pages/` - Main page components (LoginPage, Dashboard)
- `src/components/` - Feature components (ServerDetailPanel, ContainerDetailPanel, etc.)
- `src/contexts/` - React context providers
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and API client

### Theming
- Light/dark mode support via CSS variables
- System theme detection with manual override
- Theme preference stored in localStorage

## External Dependencies

### Komodo Server API
- The app connects to a user-provided Komodo server instance
- Requires API key and secret for authentication
- Server URL configured at runtime through login form

### npm Package Dependencies
- `komodo_client` - Official Komodo API client library
- `@tanstack/react-query` - Data fetching and caching
- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli` - Mobile platform
- `recharts` - Charts for server stats visualization
- Radix UI primitives - Accessible UI component foundations
- `vaul` - Drawer component
- `sonner` - Toast notifications

### Build Tools
- Vite with React SWC plugin
- TypeScript with relaxed strictness settings
- ESLint for linting
- PostCSS with Tailwind and Autoprefixer