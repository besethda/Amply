#!/bin/bash

ENDPOINT="https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com/\$default"

echo "=== Testing Polling Workflow ==="
echo ""

# Test 1: Create stack
echo "1️⃣ POST /connect - Creating artist environment..."
RESPONSE=$(curl -s -X POST "$ENDPOINT/connect" \
  -H "Content-Type: application/json" \
  -d '{"artistName":"PollingTestArtist"}')

echo "$RESPONSE" | jq .
STACK_NAME=$(echo "$RESPONSE" | jq -r '.stackName')
echo "Stack Name: $STACK_NAME"
echo ""

# Test 2: Check status immediately
echo "2️⃣ GET /stack-status/{stackName} - Checking status (should be IN_PROGRESS)..."
sleep 2
curl -s -X GET "$ENDPOINT/stack-status/$STACK_NAME" | jq .
echo ""

echo "✅ Test complete!"
echo ""
echo "The stack will take 5-10 minutes to complete."
echo "You can continue polling with:"
echo "curl -s https://u7q5tko85l.execute-api.eu-north-1.amazonaws.com/\$default/stack-status/$STACK_NAME | jq ."
