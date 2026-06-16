#!/bin/bash
# Deploy frontend to Cloudflare Pages
cd frontend && npm run build && npx wrangler pages deploy dist --project-name=dada-jobhunt --branch=main
echo "Frontend deployed at: https://dada-jobhunt.pages.dev/"