from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import re
import sqlite3

# LangGraph integration - loads environment variables
from chapter_ingest_graph import run_chapter_ingest

from pathlib import Path
from dotenv import load_dotenv
import json

# Load .env file (for development)
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


# Load user config file (for production)
def load_user_config():
    """Load configuration from user's AppData directory"""
    try:
        config_dir = Path.home() / "AppData" / "Roaming" / "Writegeist"
        config_file = config_dir / "config.json"

        if config_file.exists():
            print(f"Loading config from: {config_file}")
            with open(config_file, "r") as f:
                config = json.load(f)

            # Set environment variables from config
            for key, value in config.items():
                if value:  # Only set if value is not empty
                    os.environ[key] = str(value)
                    print(f"Loaded config: {key}")
        else:
            print(f"No config file found at: {config_file}")
    except Exception as e:
        print(f"Error loading user config: {e}")


# Load user configuration
load_user_config()

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


class EchoReq(BaseModel):
    text: str


class ChapterIngestReq(BaseModel):
    title: str
    text: str


class Patch(BaseModel):
    section: str                # e.g. "Characters"
    h2: str | None = None       # optional sub-header
    replace: str                # the full markdown block


# Remove regex helper functions - now using OpenAI via LangGraph


@app.post("/echo")
def echo(req: EchoReq):
    return {"echo": req.text}


@app.post("/ingest_chapter")
def ingest_chapter(req: ChapterIngestReq):
    """
    Ingest a chapter and extract metadata using OpenAI GPT-4o via LangGraph workflow.
    """
    # Check if OpenAI API key is configured
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(status_code=501, detail={"error": "No API key"})

    try:
        # Run the LangGraph workflow with OpenAI
        result = run_chapter_ingest(req.title, req.text)
        return {"log": result.get("log", []), **result}
    except Exception as e:
        # Handle any errors gracefully
        raise HTTPException(
            status_code=500, detail={"error": f"Chapter ingestion failed: {str(e)}"}
        )


@app.get("/project/section/{section_name}")
def get_project_section(section_name: str):
    """
    Get a specific section from the project markdown file.
    """
    try:
        markdown_content = load_markdown()
        section_content = extract_section(markdown_content, section_name)
        return {"markdown": section_content}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to load project section: {str(e)}"},
        )


@app.post("/n8n/proposal", status_code=202)
def accept_patch(patch: Patch):
    """
    n8n sends a complete markdown block that should replace the
    current block and update the project database.
    """
    try:
        # Load current project markdown
        current_markdown = load_markdown()
        
        # Apply the patch to the specified section
        updated_markdown = apply_patch_to_section(current_markdown, patch.section, patch.replace)
        
        # Save the updated markdown back to the database
        save_markdown_to_database(updated_markdown)
        
        # Update the last modified timestamp for webhook notifications
        update_last_modified()
        
        # Also write to temporary file for debugging
        data_dir = Path(__file__).parent / "data"
        data_dir.mkdir(exist_ok=True)
        outfile = data_dir / "n8n_proposal.md"
        outfile.write_text(
            f"### {patch.section} / {patch.h2 or '(root)'}\n\n{patch.replace}",
            encoding="utf-8",
        )
        
        # Log the received patch
        print(f"Appended n8n patch to section '{patch.section}': {len(patch.replace)} characters")
        
        return {"status": "applied", "section": patch.section, "file": str(outfile)}
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail={"error": f"Failed to process patch: {str(e)}"}
        )


@app.get("/download-db")
def download_database():
    """
    Simple endpoint to download the database file for syncing.
    This allows local apps to sync with the VM database.
    """
    try:
        from fastapi.responses import FileResponse
        
        # Path to the database file
        db_path = Path(__file__).parent.parent / "writegeist.db"
        
        if not db_path.exists():
            raise HTTPException(status_code=404, detail="Database file not found")
        
        return FileResponse(
            path=str(db_path),
            filename="writegeist.db",
            media_type="application/octet-stream"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to download database: {str(e)}"}
        )


@app.options("/upload-project")
def upload_project_options():
    """Handle preflight OPTIONS request for upload-project endpoint"""
    return {"message": "OK"}

@app.post("/upload-project")
def upload_project_content(content: dict):
    """
    Upload project content to the VM database.
    This allows local apps to push their changes to the VM.
    """
    try:
        markdown_content = content.get("markdown", "")
        
        if not markdown_content:
            raise HTTPException(status_code=400, detail="No markdown content provided")
        
        # Save the markdown to the VM database
        save_markdown_to_database(markdown_content)
        
        # Update the last modified timestamp
        update_last_modified()
        
        print(f"✅ Project content uploaded to VM database: {len(markdown_content)} characters")
        
        return {
            "status": "success",
            "message": "Project content uploaded successfully",
            "content_length": len(markdown_content)
        }
    
    except Exception as e:
        print(f"❌ Failed to upload project content: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={"error": f"Failed to upload project content: {str(e)}"}
        )


# Simple file to track last update time
LAST_UPDATE_FILE = Path(__file__).parent / "last_update.txt"

@app.get("/last-updated")
def get_last_updated():
    """
    Get the timestamp of the last database update.
    Local apps can check this to know when to sync.
    """
    try:
        if LAST_UPDATE_FILE.exists():
            return {"last_updated": LAST_UPDATE_FILE.read_text().strip()}
        else:
            return {"last_updated": "0"}
    except Exception as e:
        return {"last_updated": "0"}

def update_last_modified():
    """Update the last modified timestamp"""
    try:
        import time
        LAST_UPDATE_FILE.write_text(str(int(time.time())))
    except Exception:
        pass


# Helper functions
def load_markdown():
    """Load the project markdown from the SQLite database (same as frontend)"""
    try:
        # Use the same database file as the frontend (in project root)
        db_path = Path(__file__).parent.parent / "writegeist.db"

        # If database doesn't exist, create it with default content
        if not db_path.exists():
            return create_default_project_doc(db_path)

        # Connect to database and get the project markdown
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Get the project markdown from project_pages table
        cursor.execute("SELECT markdown FROM project_pages WHERE id = 1")
        result = cursor.fetchone()

        if result:
            markdown_content = result[0]
        else:
            # No project document exists, create default
            markdown_content = create_default_project_doc(db_path)

        conn.close()
        return markdown_content

    except Exception as e:
        print(f"Error loading from database: {e}")
        # Fallback to default content
        return """# My Project

## Ideas-Notes

## Setting

## Full Outline

## Characters"""


def create_default_project_doc(db_path):
    """Create default project document in database"""
    default_markdown = """# My Project

## Ideas-Notes

## Setting

## Full Outline

## Characters"""

    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Create tables if they don't exist (same as frontend)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_pages (
                id INTEGER PRIMARY KEY,
                markdown TEXT NOT NULL
            )
        """
        )

        # Insert default project document
        cursor.execute(
            "INSERT OR REPLACE INTO project_pages (id, markdown) VALUES (1, ?)",
            (default_markdown,),
        )

        conn.commit()
        conn.close()
        return default_markdown

    except Exception as e:
        print(f"Error creating default project: {e}")
        return default_markdown



def extract_section(markdown: str, section_name: str) -> str:
    """Extract section content between ## headers"""
    lines = markdown.split('\n')
    section_start = None
    section_end = len(lines)
    
    # Find the start of our section
    for i, line in enumerate(lines):
        if re.match(rf'^\s*##\s+{re.escape(section_name)}\s*$', line, re.I):
            section_start = i + 1
            break
    
    if section_start is None:
        return ""
    
    # Find the end (next ## header)
    for i in range(section_start, len(lines)):
        if re.match(r'^\s*##\s+', lines[i]):
            section_end = i
            break
    
    # Extract and clean the content
    content_lines = lines[section_start:section_end]
    # Remove empty lines at start and end
    while content_lines and not content_lines[0].strip():
        content_lines.pop(0)
    while content_lines and not content_lines[-1].strip():
        content_lines.pop()
    
    return '\n'.join(content_lines)


def apply_patch_to_section(markdown: str, section_name: str, new_content: str) -> str:
    """Intelligently append new content to a specific section, avoiding duplicates"""
    lines = markdown.split('\n')
    section_header_index = None
    section_start = 0
    section_end = len(lines)
    
    # Find the section header
    for i, line in enumerate(lines):
        if re.match(rf'^\s*##\s+{re.escape(section_name)}\s*$', line, re.I):
            section_header_index = i
            section_start = i + 1
            break
    
    if section_header_index is None:
        # Section doesn't exist, add it at the end
        if lines and lines[-1].strip():
            lines.append('')  # Add blank line before new section
        lines.append(f'## {section_name}')
        lines.append('')
        lines.extend(new_content.split('\n'))
        return '\n'.join(lines)
    
    # Find the end of the section (next ## header)
    for i in range(section_start, len(lines)):
        if re.match(r'^\s*##\s+', lines[i]):
            section_end = i
            break
    
    # Get existing section content
    existing_content = '\n'.join(lines[section_start:section_end]).strip()
    
    # Extract the core content to check for duplicates
    new_content_clean = new_content.strip()
    
    # Enhanced duplicate detection
    print(f"Checking for duplicates in {section_name}...")
    print(f"New content: {new_content_clean[:100]}...")
    
    # Check if the new content already exists in the section (exact match)
    if new_content_clean in existing_content:
        print(f"Exact content already exists in {section_name}, skipping duplicate")
        return markdown
    
    # For bullet points, do more thorough duplicate checking
    if new_content_clean.startswith('* '):
        new_lines_to_add = new_content_clean.split('\n')
        
        for new_line in new_lines_to_add:
            new_line_stripped = new_line.strip()
            if not new_line_stripped.startswith('* '):
                continue
                
            # Extract the main part (everything after the bullet)
            new_item = new_line_stripped[2:].strip()
            
            # Check if this item already exists (multiple ways)
            for line in lines[section_start:section_end]:
                if line.strip().startswith('* '):
                    existing_item = line.strip()[2:].strip()
                    
                    # Check exact match (case-insensitive)
                    if existing_item.lower() == new_item.lower():
                        print(f"Exact duplicate '{new_item}' found in {section_name}, skipping entire patch")
                        return markdown
                    
                    # Check name match (before parentheses or dashes)
                    new_name = new_item.split('(')[0].split('—')[0].strip()
                    existing_name = existing_item.split('(')[0].split('—')[0].strip()
                    
                    if new_name.lower() == existing_name.lower() and len(new_name) > 2:
                        print(f"Name '{new_name}' already exists in {section_name}, skipping entire patch")
                        return markdown
                    
                    # Check for partial matches (80% similarity)
                    if len(new_item) > 10 and len(existing_item) > 10:
                        # Simple similarity check
                        new_words = set(new_item.lower().split())
                        existing_words = set(existing_item.lower().split())
                        
                        if len(new_words) > 0 and len(existing_words) > 0:
                            similarity = len(new_words.intersection(existing_words)) / len(new_words.union(existing_words))
                            if similarity > 0.8:
                                print(f"Similar content found (similarity: {similarity:.2f}), skipping: '{new_item}'")
                                return markdown
    
    # For multi-line content, check line by line
    else:
        new_lines_to_check = [line.strip() for line in new_content_clean.split('\n') if line.strip()]
        existing_lines = [line.strip() for line in existing_content.split('\n') if line.strip()]
        
        # Check if any of the new lines already exist
        for new_line in new_lines_to_check:
            if new_line in existing_lines:
                print(f"Line already exists in {section_name}: '{new_line}', skipping entire patch")
                return markdown
    
    # Add the new content to the end of the section
    new_lines = lines[:section_end]  # Keep everything up to the end of this section
    
    if new_content_clean:
        # Add a blank line if the section isn't empty
        if section_end > section_start and lines[section_end - 1].strip():
            new_lines.append('')
        new_lines.extend(new_content.split('\n'))
    
    # Add remaining lines after the section
    if section_end < len(lines):
        new_lines.extend(lines[section_end:])
    
    print(f"Adding new content to {section_name}: {len(new_content_clean)} characters")
    return '\n'.join(new_lines)


def save_markdown_to_database(markdown: str):
    """Save the updated markdown to the database"""
    try:
        # Use the same database file as the frontend (in project root)
        db_path = Path(__file__).parent.parent / "writegeist.db"
        
        # Connect to database and update the project markdown
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Create tables if they don't exist (same as frontend)
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS project_pages (
                id INTEGER PRIMARY KEY,
                markdown TEXT NOT NULL
            )
        """
        )
        
        # Update the project markdown
        cursor.execute(
            "INSERT OR REPLACE INTO project_pages (id, markdown) VALUES (1, ?)",
            (markdown,),
        )
        
        conn.commit()
        conn.close()
        
        print("Successfully saved updated markdown to database")
        
    except Exception as e:
        print(f"Error saving to database: {e}")
        raise
