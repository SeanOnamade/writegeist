#!/usr/bin/env python3
"""
Test script to verify the new sync functionality with loading states and force refresh
"""

import requests
import json
import time
from datetime import datetime

def test_vm_api_submission():
    """Test submitting a unique idea to VM API"""
    url = "https://python-fastapi-u50080.vm.elestio.app/n8n/proposal"
    
    # Create unique test idea with timestamp
    timestamp = datetime.now().strftime("%H:%M:%S")
    test_idea = f"Test sync at {timestamp} - Magic fountain in the courtyard"
    
    payload = {
        "idea": test_idea
    }
    
    print(f"🚀 Testing VM API submission...")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"✅ Response Status: {response.status_code}")
        print(f"✅ Response Body: {response.text}")
        
        if response.status_code == 200:
            print("✅ VM API submission successful!")
            return True
        else:
            print(f"❌ VM API submission failed with status {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return False

def test_vm_last_updated():
    """Test checking when VM database was last updated"""
    url = "https://python-fastapi-u50080.vm.elestio.app/last-updated"
    
    print(f"\n🕐 Testing VM last-updated endpoint...")
    
    try:
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            timestamp = data.get('last_updated', 0)
            readable_time = datetime.fromtimestamp(timestamp).strftime("%H:%M:%S")
            
            print(f"✅ VM last updated at: {readable_time}")
            return timestamp
        else:
            print(f"❌ Failed to get last updated time: {response.status_code}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        return None

def test_local_webhook():
    """Test local webhook server health"""
    url = "http://localhost:3001/health"
    
    print(f"\n🏠 Testing local webhook server...")
    
    try:
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            print("✅ Local webhook server is running!")
            return True
        else:
            print(f"❌ Local webhook server returned {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Local webhook server not accessible: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 TESTING NEW SYNC FUNCTIONALITY WITH LOADING STATES")
    print("=" * 60)
    
    # Test 1: Check local webhook server
    webhook_ok = test_local_webhook()
    
    # Test 2: Get current VM timestamp
    initial_timestamp = test_vm_last_updated()
    
    # Test 3: Submit unique idea to VM
    if test_vm_api_submission():
        print("\n⏳ Waiting 5 seconds for VM processing...")
        time.sleep(5)
        
        # Test 4: Check if timestamp changed
        new_timestamp = test_vm_last_updated()
        
        if new_timestamp and initial_timestamp:
            if new_timestamp > initial_timestamp:
                print("✅ VM database was updated after submission!")
                print("✅ Polling should detect this change and trigger sync")
            else:
                print("⚠️  VM timestamp unchanged - idea may have been duplicate")
        
        print("\n📱 Check your Writegeist app:")
        print("1. You should see 'Syncing latest changes...' loading overlay")
        print("2. Project content should refresh automatically")
        print("3. New content should appear without manual refresh")
        
    print("\n" + "=" * 60)
    print("🎯 Test completed! Check the app UI for sync status updates.")

if __name__ == "__main__":
    main() 