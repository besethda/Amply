#!/usr/bin/env python3
import json
import subprocess
import time

TEST_TOKEN = "eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJzdWIiOiAiMjA2YzA5Y2MtNTAxMS03MDZmLWRjNDgtNDViZGE0M2U2MWJmIiwgImVtYWlsIjogInRlc3RAZXhhbXBsZS5jb20ifQ.signature"
ARTIST_ID = "206c09cc-5011-706f-dc48-45bda43e61bf"

def invoke_lambda(path, method, body=None):
    payload = {
        "rawPath": path,
        "httpMethod": method,
        "headers": {"authorization": f"Bearer {TEST_TOKEN}"},
        "requestContext": {
            "http": {"method": method},
            "authorizer": {"claims": {"sub": ARTIST_ID}}
        }
    }
    if body:
        payload["body"] = json.dumps(body)
    
    with open("/tmp/test.json", "w") as f:
        json.dump(payload, f)
    
    subprocess.run(
        ["aws", "lambda", "invoke", "--function-name", "AmplyAPI", "--region", "eu-north-1", 
         "--cli-binary-format", "raw-in-base64-out", "--payload", "file:///tmp/test.json", "/tmp/resp.json"],
        capture_output=True
    )
    
    with open("/tmp/resp.json") as f:
        resp = json.loads(f.read())
    
    status = resp.get('statusCode')
    body_str = resp.get('body', '')
    body_obj = json.loads(body_str) if isinstance(body_str, str) else body_str
    
    return status, body_obj

# Test flow
print("=" * 60)
print("RELEASE-FIRST ARCHITECTURE TEST")
print("=" * 60)

# 1. Create release (no songs)
print("\n1️⃣ Create Release (without songs)")
status, resp = invoke_lambda("/create-release", "POST", {
    "releaseType": "single",
    "title": "Test Single Release",
    "description": "A test single",
    "releaseDate": "2026-01-13"
})
print(f"  Status: {status}")
release_id = resp.get("releaseId", "unknown")
print(f"  Release ID: {release_id}")
print(f"  Response: {json.dumps(resp, indent=2)[:300]}")

time.sleep(0.5)

# 2. Add song to release
print(f"\n2️⃣ Add Song to Release")
status, resp = invoke_lambda(f"/release/{release_id}/add-song", "POST", {
    "title": "Song 1",
    "genre": "Electronic",
    "duration": 240,
    "s3Key": f"songs/{ARTIST_ID}/{release_id}/song1.mp3"
})
print(f"  Status: {status}")
song_id = resp.get("songId", "unknown")
print(f"  Song ID: {song_id}")
print(f"  Response: {json.dumps(resp, indent=2)[:200]}")

time.sleep(0.5)

# 3. Get songs in release
print(f"\n3️⃣ Get Songs in Release")
status, resp = invoke_lambda(f"/release/{release_id}/songs", "GET")
print(f"  Status: {status}")
print(f"  Songs count: {len(resp.get('songs', []))}")
print(f"  Response: {json.dumps(resp, indent=2)[:300]}")

time.sleep(0.5)

# 4. Get song details
print(f"\n4️⃣ Get Song Details")
status, resp = invoke_lambda(f"/songs/{song_id}", "GET")
print(f"  Status: {status}")
print(f"  Song: {resp.get('title')}")
print(f"  Response: {json.dumps(resp, indent=2)[:200]}")

time.sleep(0.5)

# 5. Remove song from release
print(f"\n5️⃣ Remove Song from Release")
status, resp = invoke_lambda(f"/release/{release_id}/song/{song_id}", "DELETE")
print(f"  Status: {status}")
print(f"  Response: {json.dumps(resp, indent=2)}")

time.sleep(0.5)

# 6. Verify song is gone
print(f"\n6️⃣ Verify Song Deleted (should 404)")
status, resp = invoke_lambda(f"/songs/{song_id}", "GET")
print(f"  Status: {status}")
print(f"  Response: {json.dumps(resp, indent=2)[:200]}")

print("\n" + "=" * 60)
print("✅ NEW ARCHITECTURE TEST COMPLETE")
print("=" * 60)
