#!/usr/bin/env python3
"""
Check what endpoints currently exist on VM
"""

import requests

def check_vm_endpoints():
    """Check VM API endpoints"""
    base_url = "https://python-fastapi-u50080.vm.elestio.app"
    
    print("🔍 Checking VM Endpoints")
    print("=" * 40)
    
    endpoints_to_check = [
        "/",
        "/n8n/proposal", 
        "/download-db",
        "/last-updated",
        "/echo"
    ]
    
    for endpoint in endpoints_to_check:
        try:
            if endpoint == "/n8n/proposal":
                # POST request for proposal endpoint
                response = requests.post(f"{base_url}{endpoint}", 
                    json={"section": "test", "replace": "test"}, 
                    timeout=10)
            else:
                # GET request for others
                response = requests.get(f"{base_url}{endpoint}", timeout=10)
            
            print(f"   {endpoint}: ✅ {response.status_code}")
            
        except requests.exceptions.RequestException as e:
            print(f"   {endpoint}: ❌ {str(e)[:50]}...")

if __name__ == "__main__":
    check_vm_endpoints() 