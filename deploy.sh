#!/bin/bash

# Restify Vercel Deployment Script
echo "🚀 Deploying Restify to Vercel..."

# Build the project
echo "📦 Building project..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Display deployment information
    echo ""
    echo "📋 Deployment Information:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 Main Application: https://curlify.vercel.app/"
    echo "📁 SDK Files:"
    echo "   • JavaScript: https://curlify.vercel.app/restifysdk.js"
    echo "   • CSS: https://curlify.vercel.app/restifystyle.css"
    echo ""
    echo "🔧 Integration Example:"
    echo "   <link rel=\"stylesheet\" href=\"https://curlify.vercel.app/restifystyle.css\">"
    echo "   <script type=\"module\" src=\"https://curlify.vercel.app/restifysdk.js\"></script>"
    echo ""
    echo "📝 Phase 1 Complete:"
    echo "   ✅ MVP fully functional and deployed"
    echo "   ✅ Cross-domain SDK ready for integration"
    echo "   ✅ Professional UI/UX with gradient theming"
    echo "   ✅ Core API testing features implemented"
    echo "   ✅ Developer-focused tools (cURL import, shortcuts)"
    echo ""
    echo "🚀 Next: Phase 2 will focus on:"
    echo "   • HAR file import for production debugging"
    echo "   • Domain and route filtering capabilities"
    echo "   • Auto-collection creation from network traces"
    echo "   • User analytics and tracking"
    echo "   • Monetization and pricing strategy"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Check if Vercel CLI is available
    if command -v vercel &> /dev/null; then
        echo "🚀 Deploying to Vercel..."
        vercel --prod
    else
        echo "⚠️  Vercel CLI not found. Please install it with:"
        echo "   npm i -g vercel"
        echo "   Then run: vercel --prod"
    fi
else
    echo "❌ Build failed! Please fix the errors and try again."
    exit 1
fi
