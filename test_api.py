import requests
import json
import sqlite3

# Test the API endpoint directly
def test_api_endpoint():
    print("Testing API endpoint directly...")
    
    # Check database state BEFORE API call
    print("\n=== BEFORE API CALL ===")
    conn = sqlite3.connect('writegeist.db')
    cursor = conn.cursor()
    cursor.execute('SELECT markdown FROM project_pages')
    before_content = cursor.fetchone()[0]
    print(f"Characters section before: {len(before_content)} characters")
    conn.close()
    
    # Call the API endpoint
    url = "http://localhost:8000/n8n/proposal"
    payload = {
        "section": "Characters",
        "replace": "* Max (shadow wizard) — can control shadows"
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"API Response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        # Check database state AFTER API call
        print("\n=== AFTER API CALL ===")
        conn = sqlite3.connect('writegeist.db')
        cursor = conn.cursor()
        cursor.execute('SELECT markdown FROM project_pages')
        after_content = cursor.fetchone()[0]
        print(f"Characters section after: {len(after_content)} characters")
        print("\nFull content:")
        print(after_content)
        conn.close()
        
    except Exception as e:
        print(f"Error calling API: {e}")

if __name__ == "__main__":
    test_api_endpoint() 