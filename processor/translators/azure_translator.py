import requests
import json
import os
import re
import time
from config import AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, DEFAULT_DEPLOYMENT_NAME, DEFAULT_API_VERSION

class AzureTranslator:
    """Base class for Azure OpenAI API integration for all translators."""

    def __init__(self, api_key=None, endpoint=None):
        """
        Initialize the translator with Azure OpenAI API credentials.
        
        Args:
            api_key (str, optional): API key for Azure OpenAI. Defaults to environment variable.
            endpoint (str, optional): Azure OpenAI endpoint. Defaults to environment variable.
        """
        # Get API key and endpoint from environment or config if not provided
        self.api_key = api_key or os.environ.get('AZURE_OPENAI_API_KEY', AZURE_OPENAI_API_KEY)
        self.endpoint = endpoint or os.environ.get('AZURE_OPENAI_ENDPOINT', AZURE_OPENAI_ENDPOINT)
        
        # Ensure endpoint ends with a slash
        if not self.endpoint.endswith('/'):
            self.endpoint += '/'
        
        # Set the specific deployment name and API version
        self.deployment_name = DEFAULT_DEPLOYMENT_NAME
        self.api_version = DEFAULT_API_VERSION
        
        print(f"Initialized AzureTranslator with endpoint: {self.endpoint} and deployment: {self.deployment_name}")

    def call_azure_openai_api(self, prompt_text, max_tokens=150, temperature=0.3):
        """
        Call the Azure OpenAI API to process the text using direct REST calls.
        Includes retry logic with exponential backoff for rate limiting.
        
        Args:
            prompt_text (str): The formatted prompt text to send to the API
            max_tokens (int, optional): Maximum number of tokens to generate. Defaults to 150.
            temperature (float, optional): Sampling temperature. Defaults to 0.3.
            
        Returns:
            str: The API response text
        """
        url = f"{self.endpoint}openai/deployments/{self.deployment_name}/chat/completions?api-version={self.api_version}"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key
        }
        
        payload = {
            "messages": [
                {"role": "system", "content": "You are a specialized language transformation assistant."},
                {"role": "user", "content": prompt_text}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": 1,
            "frequency_penalty": 0,
            "presence_penalty": 0
        }
        
        # Implement retry logic with exponential backoff
        max_retries = 5
        retry_delay = 1  # Start with 1 second delay
        
        for attempt in range(max_retries):
            try:
                print(f"Calling API with deployment: {self.deployment_name}, API version: {self.api_version} (attempt {attempt+1})")
                response = requests.post(url, headers=headers, data=json.dumps(payload))
                
                # Handle rate limit errors (429)
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        # Extract retry-after header if available, otherwise use exponential backoff
                        retry_after = int(response.headers.get('Retry-After', retry_delay))
                        print(f"Rate limited (429). Retrying in {retry_after} seconds...")
                        time.sleep(retry_after)
                        retry_delay = min(retry_delay * 2, 60)  # Double delay up to max of 60 seconds
                        continue
                    else:
                        print(f"Max retries reached for rate limiting")
                        return f"Error: Rate limit exceeded after {max_retries} attempts"
                
                # Raise for other HTTP errors
                response.raise_for_status()
                
                result = response.json()
                
                # Extract the message content from the chat response
                if "choices" in result and len(result["choices"]) > 0:
                    if "message" in result["choices"][0] and "content" in result["choices"][0]["message"]:
                        raw_response = result["choices"][0]["message"]["content"].strip()
                        # Fix punctuation spacing before returning
                        return self.fix_punctuation_spacing(raw_response)
                
                # If we couldn't extract the response properly, log and return empty string
                print(f"Unexpected response format from Azure OpenAI Chat API: {result}")
                return ""
            
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    print(f"Request error: {str(e)}. Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, 60)  # Double delay up to max of 60 seconds
                else:
                    print(f"Error calling Azure OpenAI API after {max_retries} attempts: {str(e)}")
                    return f"Error: {str(e)}"
    
    def stream_response(self, prompt_text, max_tokens=150, temperature=0.3):
        """
        Stream the response from Azure OpenAI API using direct REST calls.
        Includes retry logic with exponential backoff for rate limiting.
        
        Args:
            prompt_text (str): The formatted prompt text to send to the API
            max_tokens (int, optional): Maximum number of tokens to generate. Defaults to 150.
            temperature (float, optional): Sampling temperature. Defaults to 0.3.
            
        Returns:
            Generator: A generator yielding response chunks
        """
        url = f"{self.endpoint}openai/deployments/{self.deployment_name}/chat/completions?api-version={self.api_version}"
        
        headers = {
            "Content-Type": "application/json",
            "api-key": self.api_key
        }
        
        payload = {
            "messages": [
                {"role": "system", "content": "You are a specialized language transformation assistant."},
                {"role": "user", "content": prompt_text}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": 1,
            "stream": True,
            "frequency_penalty": 0,
            "presence_penalty": 0
        }
        
        # Implement retry logic with exponential backoff
        max_retries = 5
        retry_delay = 1  # Start with 1 second delay
        
        for attempt in range(max_retries):
            try:
                print(f"Streaming API call with deployment: {self.deployment_name} (attempt {attempt+1})")
                response = requests.post(url, headers=headers, json=payload, stream=True)
                
                # Handle rate limit errors (429)
                if response.status_code == 429:
                    if attempt < max_retries - 1:
                        # Extract retry-after header if available, otherwise use exponential backoff
                        retry_after = int(response.headers.get('Retry-After', retry_delay))
                        print(f"Rate limited (429). Retrying in {retry_after} seconds...")
                        time.sleep(retry_after)
                        retry_delay = min(retry_delay * 2, 60)  # Double delay up to max of 60 seconds
                        continue
                    else:
                        print(f"Max retries reached for rate limiting")
                        yield f"Error: Rate limit exceeded after {max_retries} attempts"
                        return
                
                # Raise for other HTTP errors
                response.raise_for_status()
                
                # For streaming, collect the full response to fix punctuation at the end
                full_response = ""
                
                for line in response.iter_lines():
                    if line:
                        line = line.decode('utf-8')
                        if line.startswith('data:'):
                            line = line[5:].strip()
                            if line == '[DONE]':
                                break
                            try:
                                json_data = json.loads(line)
                                if 'choices' in json_data and len(json_data['choices']) > 0:
                                    delta = json_data['choices'][0].get('delta', {})
                                    if 'content' in delta:
                                        chunk = delta['content']
                                        full_response += chunk
                                        yield chunk
                            except json.JSONDecodeError:
                                continue
                
                # After streaming is complete, yield a special "FIX" message with the corrected response
                corrected_response = self.fix_punctuation_spacing(full_response)
                if corrected_response != full_response:
                    yield "\n[PUNCTUATION_FIXED]"
                    yield corrected_response
                
                return
            
            except requests.exceptions.RequestException as e:
                if attempt < max_retries - 1:
                    print(f"Request error during streaming: {str(e)}. Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay = min(retry_delay * 2, 60)  # Double delay up to max of 60 seconds
                else:
                    print(f"Error streaming response after {max_retries} attempts: {str(e)}")
                    yield f"Error: {str(e)}"
                    return
    
    def fix_punctuation_spacing(self, text):
        if not text:
            return text

        # 1) Re‐merge numbers separated by commas (e.g., “10,000”)
        fixed_text = re.sub(r'(\d+)[\s\u00A0]*,[\s\u00A0]*(\d+)', r'\1,\2', text)

        # 2) Remove spaces **before** punctuation
        fixed_text = re.sub(r'\s+\.', '.', fixed_text)
        fixed_text = re.sub(r'\s+,', ',', fixed_text)
        fixed_text = re.sub(r'\s+;', ';', fixed_text)
        fixed_text = re.sub(r'\s+:', ':', fixed_text)
        fixed_text = re.sub(r'\s+\?', '?', fixed_text)
        fixed_text = re.sub(r'\s+!', '!', fixed_text)

        # 3) Add a space **after** each punctuation if it’s not followed by space/digit
        fixed_text = re.sub(r',(?=[^\s\d])', ', ', fixed_text)
        fixed_text = re.sub(r'\.(?=[^\s\d])', '. ', fixed_text)
        fixed_text = re.sub(r';(?=\S)', '; ', fixed_text)
        fixed_text = re.sub(r':(?=\S)', ': ', fixed_text)
        fixed_text = re.sub(r'!(?=\S)', '! ', fixed_text)
        fixed_text = re.sub(r'\?(?=\S)', '? ', fixed_text)

        # 4) Tighten up parentheses/brackets/quotes spacing
        fixed_text = re.sub(r'\s+\)', ')', fixed_text)
        fixed_text = re.sub(r'\(\s+', '(', fixed_text)
        fixed_text = re.sub(r'\s+\]', ']', fixed_text)
        fixed_text = re.sub(r'\[\s+', '[', fixed_text)
        fixed_text = re.sub(r'\s+\}', '}', fixed_text)
        fixed_text = re.sub(r'\{\s+', '{', fixed_text)
        fixed_text = re.sub(r'\s+\'', '\'', fixed_text)
        fixed_text = re.sub(r'\s+"', '"', fixed_text)
        fixed_text = re.sub(r'"\s+', '"', fixed_text)

        # 5) Ellipsis and dashes
        fixed_text = re.sub(r'\s+\.\.\.', '...', fixed_text)
        fixed_text = re.sub(r'\s+--', '--', fixed_text)
        fixed_text = re.sub(r'--\s+', '--', fixed_text)

        # 6) Collapse multiple spaces into one
        fixed_text = re.sub(r'\s{2,}', ' ', fixed_text)

        return fixed_text.strip()


# Example usage
if __name__ == "__main__":
    # Create an instance of the translator
    translator = AzureTranslator()
    
    # Test the API call
    result = translator.call_azure_openai_api("Translate this to French: Hello, world!")
    print(f"Translation result: {result}")
    
    # Test streaming (uncomment to use)
    """
    print("Streaming response:")
    for chunk in translator.stream_response("Explain what is Azure OpenAI in simple terms."):
        print(chunk, end="")
    """