#!/usr/bin/env bash
# Render runs this on every deploy.

set -o errexit

echo "→ Installing Python dependencies..."
pip install -r requirements.txt

echo "→ Collecting static files..."
python manage.py collectstatic --no-input

echo "→ Applying database migrations..."
python manage.py migrate

echo "✓ Build complete."