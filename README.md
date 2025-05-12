# Friction Translator

A real-time web app that analyzes “friction” language in your writing and offers clearer, more coherent suggestions — powered by modular processors and Azure Translator.

---

## 🚀 Features

- **Live Text Analysis**  
  Highlights friction words/phrases as you type and provides instant suggestions.

- **Pluggable Translators**  
  Supports Azure Translator, plus your own custom translators under `processor/translators/`.

- **Prompt Manager**  
  Manage and switch AI prompts via `prompts.json` and `prompt_manager.py`.

- **Web UI**  
  Simple Flask + JavaScript front-end with:
  - Real-time corrections (`static/js/real-time-corrections.js`)  
  - Upload & batch processing fixes (`static/js/file-upload-fix.js`)

---

## 🛠 Getting Started

### Prerequisites

- Python 3.8+  
- pip  

### Installation

```bash
# 1. Clone repo
git clone https://github.com/your-username/friction-translator.git
cd friction-translator

# 2. Create & activate virtual env
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 3. Install deps
pip install -r requirements.txt
