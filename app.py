from flask import Flask, render_template, request, jsonify, redirect, url_for, session, flash, send_file
import logging
import json
import sys
import io
import os
import re
import tempfile
import traceback
from docx import Document
from processor.text_processor import TextProcessor
from prompt_manager import PromptManager
from config import AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, ADMIN_PASSWORD
from processor.translators.azure_translator import AzureTranslator

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", os.urandom(24))
prompt_manager = PromptManager()

# Make the configuration available via os.environ if needed by other components
os.environ['AZURE_OPENAI_API_KEY'] = AZURE_OPENAI_API_KEY
os.environ['AZURE_OPENAI_ENDPOINT'] = AZURE_OPENAI_ENDPOINT

# Check if API key and endpoint are available
if not AZURE_OPENAI_API_KEY:
    app.logger.warning("AZURE_OPENAI_API_KEY is not set in config.py. LLM functionality will not work.")

if not AZURE_OPENAI_ENDPOINT:
    app.logger.warning("AZURE_OPENAI_ENDPOINT is not set in config.py. LLM functionality will not work.")

# Initialize text processor with API credentials
text_processor = TextProcessor(api_key=AZURE_OPENAI_API_KEY, endpoint=AZURE_OPENAI_ENDPOINT)

# Set up logging
app.logger.setLevel(logging.DEBUG)
handler = logging.StreamHandler(sys.stdout)
handler.setLevel(logging.DEBUG)
app.logger.addHandler(handler)

# Check for document processing libraries
try:
    import mammoth
    MAMMOTH_AVAILABLE = True
except ImportError:
    MAMMOTH_AVAILABLE = False
    app.logger.warning("mammoth library not available. Word document processing will be limited.")
    
try:
    from pdfminer.high_level import extract_text as pdf_extract_text
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False
    app.logger.warning("pdfminer.six library not available. PDF processing will be limited.")

# Define allowed file extensions
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'doc', 'docx'}

def allowed_file(filename):
    """Check if the file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login", next=request.path))
        return f(*args, **kwargs)
    return decorated

@app.route("/login", methods=["GET", "POST"])
def login():
    # If they're already logged in, send them home
    if session.get("logged_in"):
        return redirect(url_for("index"))

    error = None
    if request.method == "POST":
        pw = request.form.get("password", "")
        if pw == ADMIN_PASSWORD:
            session["logged_in"] = True
            next_url = request.args.get("next") or url_for("index")
            return redirect(next_url)
        else:
            error = "Incorrect password."

    return render_template("login.html", error=error)

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route('/download', methods=['POST'])
@login_required
def download_docx():
    text = request.form.get('text', '').strip()
    raw_name = request.form.get('filename', 'translation').strip()

    if not text:
        return redirect(url_for('index'))

    # Sanitize: remove spaces / illegal chars if you like
    safe_name = "".join(c for c in raw_name if c.isalnum() or c in (" ", "-", "_")).rstrip()
    download_name = f"{safe_name or 'translation'}.docx"

    # Build the .docx in memory
    doc = Document()
    for line in text.split('\n'):
        doc.add_paragraph(line)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)

    return send_file(
        buf,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

@app.route('/')
@login_required
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/translate', methods=['POST'])
def translate():
    """
    Process the text using Azure OpenAI-based translators and return the translated version.
    """
    data = request.get_json()
    raw_text = data.get('text', '')
    highlight = data.get('highlight', False)
    
    # ─── Normalize all curly quotes → straight quotes ───────────────────
    normalized_input = (
        raw_text
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    app.logger.debug(f"Normalized input: {repr(normalized_input)}")
    # ─────────────────────────────────────────────────────────────────────

    if not normalized_input:
        app.logger.warning("Empty text received")
        return jsonify({
            'original': '',
            'translated': '',
            'changes': [],
            'friction_words': [],
            'transformations': [],
            'highlighted': ''
        })

    try:
        app.logger.debug("Processing text with Azure OpenAI-based text_processor")
        
        if highlight:
            # Pass normalized_input into process_text(...)
            translated_text, changes, highlighted_text = text_processor.process_text(
                normalized_input, highlight_changes=True
            )
        else:
            translated_text, changes = text_processor.process_text(normalized_input)
            highlighted_text = None
        
        friction_words   = text_processor.get_friction_replacements()
        transformations  = text_processor.get_specific_transformations()

        # For each transformation, set the sentences so the front end can precisely highlight:
        for tx in transformations:
            tx["original_sentence"]   = tx.get("context", normalized_input)
            tx["translated_sentence"] = translated_text
            tx["final_processed"]     = translated_text

            for ch in changes:
                if ch["original"].strip() == tx.get("context", "").strip():
                    tx["original_sentence"]   = ch["original"]
                    tx["translated_sentence"] = ch["translated"]
                    tx["final_processed"]     = ch["translated"]
            break

        app.logger.debug(f"Transformations: {transformations}")
        app.logger.debug(f"Translation complete. Original: '{normalized_input}', Translated: '{translated_text}'")
        app.logger.debug(f"Changes: {changes}")
        app.logger.debug(f"Friction words: {friction_words}")
        app.logger.debug(f"Transformations: {transformations}")

        result = {
            # Return the normalized_input (with straight apostrophes) as “original”:
            'original': normalized_input,
            'translated': translated_text,
            'changes': changes,
            'friction_words': friction_words,
            'transformations': transformations
        }
        
        if highlighted_text is not None:
            result['highlighted'] = highlighted_text
        
        return jsonify(result)

    except Exception as e:
        app.logger.error(f"Error during translation: {str(e)}")
        return jsonify({
            'original': normalized_input,
            'translated': f"Error: {str(e)}",
            'changes': [],
            'friction_words': [],
            'transformations': [],
            'highlighted': ''
        }), 500


@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    """Analyze text for friction language and return friction points for real-time display"""
    data = request.get_json()
    raw_text = data.get('text', '')

    # ─── Normalize all curly quotes → straight quotes ───────────────────
    normalized_text = (
        raw_text
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
    )
    app.logger.debug(f"Normalized text for analysis: '{normalized_text}'")

    if not normalized_text:
        app.logger.warning("Empty text received for analysis")
        return jsonify({
            'success': True,
            'friction_points': []
        })

    try:
        from processor.sentence_parser import SentenceParser
        sentence_parser = SentenceParser()
        sentences = sentence_parser.parse(normalized_text)

        friction_points = []
        sentence_start = 0

        for sentence in sentences:
            if not sentence.strip():
                sentence_start += len(sentence)
                continue

            # 1. Check for "but/yet" friction
            but_matches = []
            for pattern in text_processor.but_patterns:
                for match in re.finditer(pattern, sentence, re.IGNORECASE):
                    but_matches.append({
                        'type': 'but',
                        'start_pos': sentence_start + match.start(),
                        'end_pos':   sentence_start + match.end(),
                        'original':  match.group(0),
                        'replacement': 'and at the same time',
                        'suggestion': 'Consider replacing "but" with "and at the same time" to give equal weight to both points'
                    })

            # 2. Check for "should/could/would" friction
            should_matches = []
            for pattern in text_processor.should_patterns:
                for match in re.finditer(pattern, sentence, re.IGNORECASE):
                    should_matches.append({
                        'type': 'should',
                        'start_pos': sentence_start + match.start(),
                        'end_pos':   sentence_start + match.end(),
                        'original':  match.group(0),
                        'replacement': 'might',
                        'suggestion': 'Consider using "might" instead of "should" to reduce the sense of obligation'
                    })

            # 3. Check for "not/never" friction
            not_matches = []
            for pattern in text_processor.not_patterns:
                for match in re.finditer(pattern, sentence, re.IGNORECASE):
                    not_matches.append({
                        'type': 'not',
                        'start_pos': sentence_start + match.start(),
                        'end_pos':   sentence_start + match.end(),
                        'original':  match.group(0),
                        'replacement': 'positive alternative',
                        'suggestion': 'Consider replacing "not" with a positive alternative'
                    })

            friction_points.extend(but_matches)
            friction_points.extend(should_matches)
            friction_points.extend(not_matches)

            sentence_start += len(sentence)

        app.logger.debug(f"Analysis complete. Found {len(friction_points)} friction points")
        return jsonify({
            'success': True,
            'friction_points': friction_points
        })

    except Exception as e:
        app.logger.error(f"Error analyzing text: {str(e)}")
        app.logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'friction_points': []
        }), 500



  # add this at the top of your file

@app.route('/alternative-suggestions', methods=['POST'])
def alternative_suggestions():
    """
    Generate alternative suggestions for a specific friction point
    """
    data = request.get_json()
    friction_type = data.get('type', '')
    original_text = data.get('text', '')
    
    app.logger.debug(f"Generating alternatives for {friction_type} friction: '{original_text}'")
    
    if not friction_type or not original_text:
        return jsonify({
            'success': False,
            'error': 'Missing required parameters'
        }), 400
    
    try:
        # Create a prompt for Azure OpenAI
        prompt = f"""
        You are a specialized language transformation assistant. Generate 3-5 alternative replacements 
        for the following friction language of type "{friction_type}".
        
        Original text: "{original_text}"
        
        Provide a list of alternative replacements that maintain the original meaning but remove the 
        friction language. Focus on making the language more positive, action-oriented, and clear.
        
        Your response should be a JSON array of strings, each representing an alternative replacement.
        For example: ["replacement 1", "replacement 2", "replacement 3"]
        """
        
        # Initialize the Azure translator
        translator = AzureTranslator(api_key=AZURE_OPENAI_API_KEY, endpoint=AZURE_OPENAI_ENDPOINT)
        
        # Get the response from Azure OpenAI
        response = translator.call_azure_openai_api(prompt, max_tokens=200)
        
        # Strip any Markdown fences (``` or ```json) before parsing
        clean = response.strip()
        clean = re.sub(r'^```(?:json)?\s*', '', clean)  # remove leading ```
        clean = re.sub(r'```$', '', clean)             # remove trailing ```
        
        # Parse the JSON response
        try:
            alternatives = json.loads(clean)
            
            # Ensure we have a valid list of alternatives
            if not isinstance(alternatives, list):
                alternatives = ["and at the same time", "while also", "as well as"]
                app.logger.warning(f"LLM response was not a list: {response}")
        except (json.JSONDecodeError, TypeError):
            app.logger.warning(f"Unable to parse JSON from LLM response: {response}")
            
            # Fallback alternatives based on friction type
            if friction_type == 'but':
                alternatives = ["and at the same time", "while also", "as well as"]
            elif friction_type == 'should':
                alternatives = ["might", "could consider", "have the option to", "may want to"]
            elif friction_type == 'not':
                alternatives = ["is different from", "is separate from", "varies from", "contrasts with"]
            else:
                alternatives = ["alternative 1", "alternative 2", "alternative 3"]
        
        app.logger.debug(f"Generated {len(alternatives)} alternatives")
        
        return jsonify({
            'success': True,
            'alternatives': alternatives
        })
    except Exception as e:
        app.logger.error(f"Error generating alternatives: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'alternatives': []
        }), 500

@app.route('/process-document', methods=['POST'])
def process_document():
    """
    Process uploaded documents and extract text
    Handles .txt, .pdf, .doc, and .docx files
    """
    app.logger.debug("Document processing request received")
    
    # Check if the post request has the file part
    if 'file' not in request.files:
        app.logger.warning("No file part in the request")
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['file']
    
    # Check if file is empty
    if file.filename == '':
        app.logger.warning("No selected file")
        return jsonify({'success': False, 'error': 'No selected file'})
    
    # Check if file type is allowed
    if not allowed_file(file.filename):
        app.logger.warning(f"File type not allowed: {file.filename}")
        return jsonify({'success': False, 'error': 'File type not allowed'})
    
    app.logger.debug(f"Processing file: {file.filename}")
    
    try:
        # Create a temporary file to save the uploaded file
        with tempfile.NamedTemporaryFile(delete=False) as temp:
            file.save(temp.name)
            temp_path = temp.name
        
        app.logger.debug(f"File saved to temporary path: {temp_path}")
        
        # Process the file based on its extension
        file_ext = os.path.splitext(file.filename)[1].lower()
        
        if file_ext == '.txt':
            # Process text file
            app.logger.debug("Processing as text file")
            with open(temp_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
            app.logger.debug(f"Text file processed, extracted {len(text)} characters")
        
        elif file_ext == '.pdf':
            # Process PDF file
            app.logger.debug("Processing as PDF file")
            if PDFMINER_AVAILABLE:
                text = pdf_extract_text(temp_path)
                app.logger.debug(f"PDF processed with pdfminer, extracted {len(text)} characters")
            else:
                app.logger.warning("PDF processing library not available")
                return jsonify({
                    'success': False, 
                    'error': 'PDF processing library not available on server'
                })
        
        elif file_ext in ['.doc', '.docx']:
            # Process Word document
            app.logger.debug("Processing as Word document")
            if MAMMOTH_AVAILABLE:
                with open(temp_path, 'rb') as docx_file:
                    result = mammoth.extract_raw_text(docx_file)
                    text = result.value
                app.logger.debug(f"Word document processed with mammoth, extracted {len(text)} characters")
            else:
                app.logger.warning("Word document processing library not available")
                return jsonify({
                    'success': False, 
                    'error': 'Word document processing library not available on server'
                })
        
        else:
            # This should never happen due to the allowed_file check
            app.logger.warning(f"Unsupported file type: {file_ext}")
            return jsonify({'success': False, 'error': 'Unsupported file type'})
        
        # Clean up the temporary file
        os.unlink(temp_path)
        app.logger.debug("Temporary file removed")
        
        # Check if any text was extracted
        if not text or len(text.strip()) == 0:
            app.logger.warning("No text could be extracted from the document")
            return jsonify({
                'success': False, 
                'error': 'No text could be extracted from the document'
            })
        
        # Return the extracted text
        app.logger.debug("Document processing successful")
        return jsonify({'success': True, 'text': text})
    
    except Exception as e:
        # Log the error
        app.logger.error(f"Error processing document: {e}")
        app.logger.error(traceback.format_exc())
        
        # Clean up temporary file if it exists
        try:
            if 'temp_path' in locals():
                os.unlink(temp_path)
                app.logger.debug("Temporary file removed after error")
        except Exception:
            pass
            
        return jsonify({'success': False, 'error': str(e)})

@app.route('/test')
def test_translators():
    """A test endpoint to verify Azure OpenAI translator functionality."""
    test_cases = [
        'You shouldn\'t ignore the signs of declining employee morale.',
        'He wouldn\'t compromise his values for short-term success.',
        'She couldn\'t believe how quickly things had changed.',
        'I like the idea, but I think we need more time.',
        'We need to focus on rebuilding trust in leadership.',
        'I don\'t want to go to the movies.',
        'I can\'t find my keys anywhere.'  # Added test case for ability context
    ]
    
    results = []
    for case in test_cases:
        # Process with text processor and get highlighted version
        processed_text, changes, highlighted_text = text_processor.process_text(case, highlight_changes=True)
        
        # Get friction words with prompts
        friction_words = text_processor.get_friction_replacements()
        
        # Get specific transformations
        transformations = text_processor.get_specific_transformations()
        
        results.append({
            'original': case,
            'translated': processed_text,
            'highlighted': highlighted_text,
            'changes': changes,
            'friction_words': friction_words,
            'transformations': transformations
        })
    
    return render_template('test.html', results=results)

@app.route('/test-api')
def test_api():
    """Test if the Azure OpenAI API key is working correctly with detailed error reporting."""
    try:
        # Initialize the translator directly to test the API
        from processor.translators.azure_translator import AzureTranslator
        
        translator = AzureTranslator(AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT)
        response = translator.call_azure_openai_api("Hello, can you respond to this message to confirm you're working?")
        
        if response:
            return jsonify({
                "status": "success",
                "message": "Azure OpenAI API is working correctly",
                "response": response
            })
        else:
            return jsonify({
                "status": "error",
                "message": "The API call returned an empty response"
            }), 500
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error testing Azure OpenAI API: {str(e)}"
        }), 500

# Prompt management routes
@app.route('/manage-prompts')
def manage_prompts():
    """Render the prompts management page."""
    return render_template('prompts.html')

@app.route('/prompts', methods=['GET'])
def get_prompts():
    """Get all prompts used by the Azure OpenAI LLM."""
    all_prompts = prompt_manager.get_all_prompts()
    return jsonify(all_prompts)

@app.route('/prompts/<word_type>', methods=['GET'])
def get_prompts_for_type(word_type):
    """Get prompts for a specific word type."""
    if word_type not in ['should', 'but', 'not']:
        return jsonify({"error": "Invalid word type"}), 400
        
    all_prompts = prompt_manager.get_all_prompts()
    if word_type in all_prompts:
        return jsonify(all_prompts[word_type])
    else:
        return jsonify({}), 404

@app.route('/prompts/<word_type>/<context>', methods=['PUT'])
def update_prompt(word_type, context):
    """Update a prompt for a specific word type and context."""
    if word_type not in ['should', 'but', 'not']:
        return jsonify({"error": "Invalid word type"}), 400
        
    data = request.get_json()
    prompt = data.get('prompt')
    example = data.get('example')
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400
        
    success = prompt_manager.set_prompt(word_type, context, prompt, example)
    
    if success:
        # Also update the prompt in the translator
        text_processor.set_prompts(word_type, prompt)
        return jsonify({"success": True, "message": "Prompt updated successfully"})
    else:
        return jsonify({"error": "Failed to update prompt"}), 500

@app.route('/prompts/<word_type>/<context>', methods=['DELETE'])
def delete_prompt(word_type, context):
    """Delete a prompt for a specific word type and context."""
    if word_type not in ['should', 'but', 'not']:
        return jsonify({"error": "Invalid word type"}), 400
        
    # Not implemented in the current version - would need to add delete support to PromptManager
    return jsonify({"error": "Delete functionality not implemented"}), 501

@app.route('/test-prompt', methods=['POST'])
def test_prompt():
    """Test a prompt with sample text."""
    data = request.get_json()
    word_type = data.get('word_type')
    prompt = data.get('prompt')
    text = data.get('text')
    
    if not word_type or not prompt or not text:
        return jsonify({"error": "Word type, prompt, and text are required"}), 400
        
    if word_type not in ['should', 'but', 'not']:
        return jsonify({"error": "Invalid word type"}), 400
    
    # Create a temporary processor with the test prompt
    temp_processor = TextProcessor(api_key=AZURE_OPENAI_API_KEY, endpoint=AZURE_OPENAI_ENDPOINT)
    temp_processor.set_prompts(word_type, prompt)
    
    try:
        # Process the text with highlighting
        result, changes, highlighted = temp_processor.process_text(text, highlight_changes=True)
        
        # Get specific transformations
        transformations = temp_processor.get_specific_transformations()
        
        return jsonify({
            "original": text,
            "result": result,
            "highlighted": highlighted,
            "changes": changes,
            "transformations": transformations
        })
    except Exception as e:
        return jsonify({"error": f"Error testing prompt: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)