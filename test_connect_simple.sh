#!/bin/bash

ARTIST_NAME="PollTestArtist$(date +%s)"
ENDPOINT="https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com/connect"

echo "Testing /connect endpoint with artist: $ARTIST_NAME"
echo ""

# Test without the $default stage
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"artistName\":\"$ARTIST_NAME\"}" | jq .
