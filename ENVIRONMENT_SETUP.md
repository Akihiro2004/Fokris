# Environment Setup Guide

This guide explains how to configure environment variables for the Forkris Accounting System.

## 🔧 Configuration Files

### 1. **Environment Configuration** (`js/env-config.js`)
- Handles loading configuration from environment variables
- Falls back to default values if environment variables are not set
- Works in both browser and Node.js environments

### 2. **Firebase Configuration** (`js/firebase-config.js`)
- Now uses environment variables from `ENV_CONFIG`
- No more hardcoded sensitive information

## 🌍 Environment Variables

Create a `.env` file in the project root with your Firebase configuration:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

# Environment
NODE_ENV=development
```

## 📁 File Structure

```
Forkris/
├── .env                    # Your environment variables (git-ignored)
├── .gitignore             # Includes .env in ignore list
├── js/
│   ├── env-config.js      # Environment configuration loader
│   ├── firebase-config.js # Firebase setup (uses env vars)
│   └── ...
└── ENVIRONMENT_SETUP.md   # This file
```

## 🚀 Usage Methods

### Method 1: Environment Variables (.env file)
1. Create a `.env` file in the project root
2. Add your Firebase configuration variables
3. The system will automatically load them

### Method 2: Browser Global Variables
If you can't use .env files, set global variables in the browser:

```html
<script>
window.ENV = {
    FIREBASE_API_KEY: 'your_api_key_here',
    FIREBASE_AUTH_DOMAIN: 'your_project.firebaseapp.com',
    // ... other config
};
</script>
```

### Method 3: Build-time Injection
If using build tools (Webpack, Vite, etc.):

```javascript
// They will automatically inject process.env variables
const config = {
    apiKey: process.env.FIREBASE_API_KEY,
    // ...
};
```

## 🔒 Security Benefits

✅ **Secrets not committed to git** - `.env` is in `.gitignore`
✅ **Different configs per environment** - dev/staging/prod
✅ **Easy deployment** - just set environment variables
✅ **Team collaboration** - everyone has their own `.env`

## 🛠️ Development Setup

1. **Clone the repository**
   ```bash
   git clone [your-repo]
   cd Forkris
   ```

2. **Create your .env file**
   ```bash
   # Copy the current config or create new one
   echo "FIREBASE_API_KEY=AIzaSyC-70SMKgU1o-f5WbKPfUiH50C79imNfDs" > .env
   echo "FIREBASE_AUTH_DOMAIN=accountingkristoforus4.firebaseapp.com" >> .env
   # ... add other variables
   ```

3. **Open in browser**
   - The system will automatically use your `.env` configuration
   - Or fall back to default values if `.env` doesn't exist

## 🌐 Deployment Options

### Option 1: Static Hosting (Netlify/Vercel)
- Set environment variables in your hosting platform
- They'll be injected at build time

### Option 2: Traditional Hosting
- Upload files including your `.env`
- Make sure `.env` is not publicly accessible

### Option 3: CDN/GitHub Pages
- Use Method 2 (Browser Global Variables)
- Or create environment-specific config files

## 🔍 Troubleshooting

### Issue: "ENV_CONFIG is not defined"
**Solution**: Make sure `js/env-config.js` loads before `js/firebase-config.js`

### Issue: Default values being used instead of .env
**Solution**: 
- Check `.env` file exists in project root
- Verify variable names match exactly
- For browser-only: use window.ENV method instead

### Issue: Firebase connection fails
**Solution**: 
- Verify all Firebase configuration values are correct
- Check Firebase project settings
- Ensure authentication is properly configured

## 📝 Current Default Configuration

The system currently defaults to:
- **Project**: accountingkristoforus4
- **API Key**: AIzaSyC-70SMKgU1o-f5WbKPfUiH50C79imNfDs
- **Auth Domain**: accountingkristoforus4.firebaseapp.com

You can override these by setting environment variables.

## 🆘 Support

If you need help setting up environment variables:
1. Check this guide first
2. Verify your Firebase project configuration
3. Test with default values first
4. Then customize with your own environment variables

---

**Note**: Remember that in client-side applications, configuration values are visible to users anyway. Environment variables help with development workflow and deployment flexibility, not with hiding sensitive data from end users.
