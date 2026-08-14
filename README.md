# Smart Residential Mobile

Smart Residential Mobile is a React Native application for residents and administrators of a residential community. It brings announcements, visitor pre-registration, helper requests, issue reporting, emergency alerts, notifications, profile management, and an AI assistant into one mobile experience.

The repository currently contains the Android and iOS client. The backend is hosted separately and must be available for most features to work.

## Features

- Two-step email/password and OTP sign-in
- OTP-based forgot-password flow
- Access-token refresh and automatic session expiry handling
- Resident dashboard with advertisements, announcements, and quick actions
- Utility bill list UI
- Visitor pre-registration and badge response
- Available-helper directory and helper requests
- Maintenance, security, and general issue reports
- Security, medical, and fire SOS alerts
- In-app notification inbox and mark-all-as-read support
- Firebase Cloud Messaging push notifications with Android notification channels
- Admin-only notification composer for one resident or all residents
- Resident profile and light/dark theme switching
- Floating AI assistant with text chat, voice input/output, RAG/tool support, chat history, and response feedback

## Current Scope

Some parts of the application are still in progress:

- The Bills screen displays local sample data from `fakeBills`; payment and billing APIs are not connected yet.
- Parking, rooms, visitor-list, profile-edit, bill-detail, and standalone OTP screen files are placeholders and are not registered in the active navigation flow.
- The automated test suite currently contains one application render smoke test. It still needs a mock or Jest transform for `react-native-audio-recorder-player` before it can pass.
- ESLint currently reports one error for an undefined `speak` reference in `FloatingChat.jsx`, along with existing style and unused-variable warnings.
- This repository does not contain the backend service or its database.

## Tech Stack

| Area | Technology |
| --- | --- |
| Mobile framework | React Native 0.85.3 |
| UI | React 19.2.3 |
| Navigation | React Navigation 7 |
| Local persistence | AsyncStorage |
| Push notifications | Firebase Cloud Messaging and Notifee |
| Voice assistant | React Native Voice, TTS, Audio Recorder Player, and React Native FS |
| Icons | React Native Vector Icons / Ionicons |
| Android | Kotlin, Gradle, min SDK 24, target SDK 36 |
| iOS | Swift, CocoaPods |
| JavaScript engine | Hermes |
| Tests | Jest and React Test Renderer |

The React Native New Architecture is enabled for both platforms.

## Repository Structure

```text
smart_residential/
├── README.md
└── Smart_city_Mobile/
    ├── android/                 # Native Android project
    ├── ios/                     # Native iOS project
    ├── patches/                 # patch-package fixes for voice and TTS
    ├── scripts/                 # Icon linking/generation helpers
    ├── src/
    │   ├── api/                 # HTTP client and feature API modules
    │   ├── assets/              # App images
    │   ├── components/          # Shared UI and floating assistant
    │   ├── config/              # API configuration
    │   ├── context/             # Authentication, chat, and theme state
    │   ├── hooks/               # Voice assistant behavior
    │   ├── navigation/          # Auth, stack, and tab navigators
    │   ├── screens/             # Feature screens
    │   └── services/            # Chat and push-notification services
    ├── __tests__/               # Jest tests
    ├── App.jsx                  # Provider and application composition
    ├── index.js                 # Native entry point and background push setup
    └── package.json             # Dependencies and npm scripts
```

## Prerequisites

Install the React Native development tools for the platform you want to run:

- Node.js 22.11.0 or newer
- npm
- Watchman on macOS (recommended)
- JDK 17
- Android Studio, Android SDK 36, and an emulator or physical Android device
- macOS and Xcode for iOS development
- Ruby 2.6.10 or newer and CocoaPods 1.13 or newer for iOS

Make sure the Android SDK environment variables and platform tools are available to your shell. For full native setup guidance, see the [React Native environment setup documentation](https://reactnative.dev/docs/set-up-your-environment).

## Installation

From the repository root:

```bash
cd Smart_city_Mobile
npm ci
```

`npm ci` also runs the `postinstall` script, which links the Ionicons font and applies the patches stored in `patches/`.

For iOS, install the Ruby and CocoaPods dependencies:

```bash
bundle install
bundle exec pod install --project-directory=ios
```

Run the pod-install command again after changing native dependencies.

## Backend Configuration

The application currently reads its API base URL from:

```text
Smart_city_Mobile/src/config/api.js
```

The checked-in configuration points to:

```text
https://54.87.203.253.sslip.io/api
```

To use a different backend, update `API_BASE_URL` in that file and rebuild or reload the app:

```js
export const API_BASE_URL = 'https://your-api.example.com/api';
```

There is no `.env` loader in the current codebase. Avoid committing production secrets; the mobile client should contain only a public API origin, never server credentials.

When using a backend on your development machine:

- Android Emulator normally reaches the host at `10.0.2.2`.
- iOS Simulator can normally use `localhost`.
- A physical device must use an address reachable on the same network.
- Prefer HTTPS. Additional Android Network Security or iOS App Transport Security configuration may be required for plain HTTP.

### API Capabilities Used by the App

| Capability | Main paths |
| --- | --- |
| Authentication | `/auth/login/step1`, `/auth/login/step2`, `/auth/refresh-token`, `/auth/logout` |
| Password reset | `/auth/forgot-password/step1`, `/auth/forgot-password/step2` |
| Profile | `/protected/profile` |
| Announcements and ads | `/announcements`, `/advertisements` |
| Notifications | `/notifications`, `/notifications/mark-all-read`, `/notifications/device-token` |
| Admin notifications | `/notifications/residents`, `/notifications/send` |
| Helpers | `/helpers`, `/helper-requests` |
| Visitors | `/visitors/register` |
| Reports and SOS | `/reports`, `/sos` |
| AI assistant | `/ai/chat`, `/ai/voice`, `/ai/history`, `/ai/feedback` |
| MCP discovery | `/mcp/tools` |

Authenticated requests send `Authorization: Bearer <access-token>`. Access and refresh tokens are stored in AsyncStorage. If an authenticated request returns `401`, the client attempts one token refresh before clearing the local session.

## Firebase Push Notifications

Push registration starts after a user signs in. The client sends the FCM device token and platform to `/notifications/device-token` and refreshes the token when Firebase rotates it.

### Android

Place the Firebase Android configuration at:

```text
Smart_city_Mobile/android/app/google-services.json
```

The Gradle build enables the Google Services plugin only when this file exists. Android 13 and newer will request notification permission at runtime. The application creates separate channels for urgent alerts, community updates, and helper requests.

### iOS

Add the matching `GoogleService-Info.plist` to the `SmartCityMobile` Xcode target, configure signing, enable Push Notifications and Background Modes/Remote notifications, and configure APNs in Firebase. Then reinstall pods and rebuild the native application.

If Firebase or Notifee is missing from an existing native build, JavaScript hot reload is not sufficient; rebuild the application.

## Running the App

Start Metro in the first terminal:

```bash
cd Smart_city_Mobile
npm start
```

Run one platform from a second terminal.

### Android

```bash
cd Smart_city_Mobile
npm run android
```

### iOS

```bash
cd Smart_city_Mobile
npm run ios
```

You can also open `android/` in Android Studio or `ios/SmartCityMobile.xcworkspace` in Xcode.

The application requests microphone access for voice chat, speech-recognition access on iOS, and notification permission where the operating system requires it.

## Available Scripts

Run these commands from `Smart_city_Mobile/`:

| Command | Description |
| --- | --- |
| `npm start` | Start the Metro development server |
| `npm run android` | Build and launch the Android app |
| `npm run ios` | Build and launch the iOS app |
| `npm test` | Run the Jest test suite |
| `npm run lint` | Run ESLint across the project |

## Testing and Quality Checks

```bash
cd Smart_city_Mobile
npm test -- --runInBand
npm run lint
```

The Jest setup mocks several native modules, but the current smoke test stops while parsing the TypeScript entry point of `react-native-audio-recorder-player`. Add a mock for that package or include it in the Jest transform configuration before treating the test command as a passing quality gate. ESLint also requires the existing undefined `speak` reference to be resolved. Add unit tests beside new API, state, and UI behavior as the application grows.

## Docker (Metro Only)

The included Dockerfile installs the JavaScript dependencies and exposes Metro on port `8081`:

```bash
cd Smart_city_Mobile
docker build -t smart-residential-mobile .
docker run --rm -it -p 8081:8081 smart-residential-mobile
```

This container runs the Metro bundler only. It does not build an APK/IPA, start an emulator, or provide the backend service.

## Release Builds

### Android

The release signing configuration reads the following Gradle properties:

```properties
SMARTCITY_UPLOAD_STORE_FILE=/absolute/path/to/upload-key.keystore
SMARTCITY_UPLOAD_STORE_PASSWORD=your-store-password
SMARTCITY_UPLOAD_KEY_ALIAS=your-key-alias
SMARTCITY_UPLOAD_KEY_PASSWORD=your-key-password
```

Keep these values outside version control, then build from the Android directory:

```bash
cd Smart_city_Mobile/android
./gradlew assembleRelease
# or
./gradlew bundleRelease
```

### iOS

Open `Smart_city_Mobile/ios/SmartCityMobile.xcworkspace`, select the correct development team and bundle identifier, configure signing, and use **Product > Archive** in Xcode.

## Troubleshooting

### Metro cache or stale JavaScript

```bash
cd Smart_city_Mobile
npm start -- --reset-cache
```

### Android cannot find a device

```bash
adb devices
```

Start an emulator or enable USB debugging on the physical device before running `npm run android`.

### Android native build is stale

```bash
cd Smart_city_Mobile/android
./gradlew clean
cd ..
npm run android
```

### iOS dependency or native-module errors

```bash
cd Smart_city_Mobile
bundle exec pod install --project-directory=ios --repo-update
npm run ios
```

### Push notifications or voice features do not load

Confirm that the native configuration files and permissions are present, reinstall dependencies, reinstall iOS pods when applicable, and perform a full native rebuild. Metro reload alone cannot add native modules to an already installed application.

## Contributing

1. Create a focused feature branch.
2. Keep API access in `src/api/` or `src/services/` rather than directly in screens.
3. Reuse the existing contexts and theme tokens for shared state and colors.
4. Add or update tests for changed behavior.
5. Run the test and lint commands before opening a pull request.
