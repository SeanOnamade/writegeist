#!/usr/bin/env python3
"""
Test all VM endpoints to see what's working
"""

import requests
import json
from datetime import datetime

def test_endpoints():
    """Test all available VM endpoints"""
    
    base_urls = [
        "https://python-fastapi-u50080.vm.elestio.app",
        "https://n8n-writegeist-u50080.vm.elestio.app"
    ]
    
    endpoints_to_test = [
        "/health",
        "/",
        "/docs",
        "/n8n/proposal",
        "/last-updated",
        "/download-db",
        "/webhook/idea-inbox"  # n8n webhook
    ]
    
    print("🧪 TESTING ALL VM ENDPOINTS")
    print("=" * 50)
    
    for base_url in base_urls:
        print(f"\n🌐 Testing: {base_url}")
        print("-" * 30)
        
        for endpoint in endpoints_to_test:
            url = base_url + endpoint
            try:
                if endpoint == "/n8n/proposal":
                    # Test POST with proper payload
                    response = requests.post(
                        url, 
                        json={"section": "Ideas-Notes", "replace": "Test from script"}, 
                        timeout=10
                    )
                elif endpoint == "/webhook/idea-inbox":
                    # Test n8n webhook format
                    response = requests.post(
                        url,
                        json={"idea": "Test n8n webhook", "timestamp": datetime.now().isoformat()},
                        timeout=10
                    )
                else:
                    # Test GET
                    response = requests.get(url, timeout=10)
                
                print(f"✅ {endpoint}: {response.status_code}")
                if response.status_code == 200:
                    try:
                        if response.headers.get('content-type', '').startswith('application/json'):
                            data = response.json()
                            print(f"   📄 Response: {json.dumps(data, indent=2)[:100]}...")
                    except:
                        print(f"   📄 Response: {response.text[:100]}...")
                        
            except requests.exceptions.RequestException as e:
                print(f"❌ {endpoint}: {str(e)[:50]}...")
    
    print("\n" + "=" * 50)

if __name__ == "__main__":
    test_endpoints() 