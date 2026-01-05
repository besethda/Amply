#!/bin/bash

# Artist Onboarding Endpoint Test Suite
# Tests all endpoints in the artist setup flow

set -e

# Configuration
API_URL="${API_URL:-https://api.amply.app}"
JWT_TOKEN="${JWT_TOKEN:-}"
TEST_ARTIST_ID="test-artist-$(date +%s)"
ARTIST_NAME="Test Artist $(date +%s)"
ROLE_ARN="${ROLE_ARN:-arn:aws:iam::123456789:role/AmplyArtistRole}"
BUCKET_NAME="${BUCKET_NAME:-amply-test-bucket}"
STACK_NAME="amply-${TEST_ARTIST_ID}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
PASSED=0
FAILED=0

# Helper functions
print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_test() {
  echo -e "${YELLOW}→ $1${NC}"
}

print_pass() {
  echo -e "${GREEN}✅ $1${NC}"
  ((PASSED++))
}

print_fail() {
  echo -e "${RED}❌ $1${NC}"
  ((FAILED++))
}

# Test 1: POST /connect - Valid artist name
test_connect_valid() {
  print_header "Test 1: POST /connect - Valid Artist Name"
  print_test "Initiating artist setup..."
  
  response=$(curl -s -X POST "$API_URL/connect" \
    -H "Content-Type: application/json" \
    -d "{\"artistName\":\"$ARTIST_NAME\"}")
  
  status=$(echo "$response" | jq -r '.status // empty')
  stack_name=$(echo "$response" | jq -r '.stackName // empty')
  
  if [ "$status" = "CREATE_IN_PROGRESS" ] && [ -n "$stack_name" ]; then
    print_pass "Artist setup initiated successfully"
    echo "Response: $(echo $response | jq .)"
  else
    print_fail "Failed to initiate artist setup"
    echo "Response: $response"
  fi
}

# Test 2: POST /connect - Missing artist name
test_connect_missing() {
  print_header "Test 2: POST /connect - Missing Artist Name"
  print_test "Attempting setup without artist name..."
  
  response=$(curl -s -X POST "$API_URL/connect" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly rejected missing artist name"
    echo "Error: $error"
  else
    print_fail "Should reject missing artist name"
    echo "Response: $response"
  fi
}

# Test 3: GET /stack-status - Non-existent stack
test_stack_status_notfound() {
  print_header "Test 3: GET /stack-status - Non-existent Stack"
  print_test "Checking status of non-existent stack..."
  
  response=$(curl -s -X GET "$API_URL/stack-status/amply-does-not-exist-123")
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly returned error for non-existent stack"
    echo "Error: $error"
  else
    print_fail "Should return error for non-existent stack"
    echo "Response: $response"
  fi
}

# Test 4: POST /complete-artist-setup - Missing required fields
test_complete_setup_missing() {
  print_header "Test 4: POST /complete-artist-setup - Missing Required Fields"
  print_test "Attempting callback without required fields..."
  
  response=$(curl -s -X POST "$API_URL/complete-artist-setup" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -d '{"artistId":"test"}')
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly rejected missing required fields"
    echo "Error: $error"
  else
    print_fail "Should reject missing required fields"
    echo "Response: $response"
  fi
}

# Test 5: POST /complete-artist-setup - Invalid token
test_complete_setup_invalid_token() {
  print_header "Test 5: POST /complete-artist-setup - Invalid Callback Token"
  print_test "Attempting callback with invalid token..."
  
  response=$(curl -s -X POST "$API_URL/complete-artist-setup" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    -d '{
      "artistId":"test-artist",
      "provider":"aws",
      "outputs":{"BucketName":"bucket"},
      "callback_token":"short"
    }')
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly rejected invalid callback token"
    echo "Error: $error"
  else
    print_fail "Should reject invalid callback token"
    echo "Response: $response"
  fi
}

# Test 6: POST /list - Missing required fields
test_list_missing() {
  print_header "Test 6: POST /list - Missing Required Fields"
  print_test "Attempting list without required fields..."
  
  response=$(curl -s -X POST "$API_URL/list" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly rejected missing fields"
    echo "Error: $error"
  else
    print_fail "Should reject missing fields"
    echo "Response: $response"
  fi
}

# Test 7: POST /get-upload-url - Missing required fields
test_get_upload_url_missing() {
  print_header "Test 7: POST /get-upload-url - Missing Required Fields"
  print_test "Attempting upload URL generation without required fields..."
  
  response=$(curl -s -X POST "$API_URL/get-upload-url" \
    -H "Content-Type: application/json" \
    -d '{}')
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly rejected missing fields"
    echo "Error: $error"
  else
    print_fail "Should reject missing fields"
    echo "Response: $response"
  fi
}

# Test 8: POST /get-upload-url - Valid request structure
test_get_upload_url_valid() {
  print_header "Test 8: POST /get-upload-url - Valid Request Structure"
  print_test "Generating presigned upload URL..."
  
  response=$(curl -s -X POST "$API_URL/get-upload-url" \
    -H "Content-Type: application/json" \
    -d "{
      \"fileName\":\"test-song.mp3\",
      \"artistRoleArn\":\"$ROLE_ARN\",
      \"bucketName\":\"$BUCKET_NAME\",
      \"contentType\":\"audio/mpeg\"
    }")
  
  upload_url=$(echo "$response" | jq -r '.uploadUrl // empty')
  expires_in=$(echo "$response" | jq -r '.expiresIn // empty')
  
  if [[ "$upload_url" =~ ^https:// ]]; then
    print_pass "Generated presigned upload URL"
    echo "Expires in: $expires_in seconds"
  else
    print_fail "Failed to generate upload URL"
    echo "Response: $response"
  fi
}

# Test 9: POST /update-index - Missing required fields
test_update_index_missing() {
  print_header "Test 9: POST /update-index - Missing Required Fields"
  print_test "Attempting index update without required fields..."
  
  response=$(curl -s -X POST "$API_URL/update-index" \
    -H "Content-Type: application/json" \
    -d '{"artistId":"test"}')
  
  error=$(echo "$response" | jq -r '.error // empty')
  
  if [ -n "$error" ]; then
    print_pass "Correctly rejected missing fields"
    echo "Error: $error"
  else
    print_fail "Should reject missing fields"
    echo "Response: $response"
  fi
}

# Test 10: CORS preflight
test_cors_preflight() {
  print_header "Test 10: CORS Preflight Request"
  print_test "Testing OPTIONS request..."
  
  http_code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL/connect" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: Content-Type")
  
  if [ "$http_code" = "204" ]; then
    print_pass "CORS preflight successful"
  else
    print_fail "CORS preflight failed with HTTP $http_code"
  fi
}

# Main execution
main() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Artist Onboarding Endpoint Test Suite                     ║"
  echo "║  $(date)                                   ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  
  echo -e "${YELLOW}Configuration:${NC}"
  echo "API URL: $API_URL"
  echo "Test Artist ID: $TEST_ARTIST_ID"
  echo "Test Artist Name: $ARTIST_NAME"
  echo ""
  
  # Run all tests
  test_connect_valid
  test_connect_missing
  test_stack_status_notfound
  test_complete_setup_missing
  test_complete_setup_invalid_token
  test_list_missing
  test_get_upload_url_missing
  test_get_upload_url_valid
  test_update_index_missing
  test_cors_preflight
  
  # Summary
  print_header "Test Summary"
  TOTAL=$((PASSED + FAILED))
  echo -e "${GREEN}Passed: $PASSED${NC}"
  echo -e "${RED}Failed: $FAILED${NC}"
  echo -e "Total: $TOTAL"
  
  if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed!${NC}"
    exit 0
  else
    echo -e "\n${RED}Some tests failed!${NC}"
    exit 1
  fi
}

# Run main function
main
