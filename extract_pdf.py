import sys, json
from unstructured.partition.pdf import partition_pdf

def extract_text(file_path):
    elements = partition_pdf(file_path)
    text = "\n".join([el.text for el in elements if hasattr(el, 'text')])
    return text

if __name__ == '__main__':
    sys.stderr = open('/dev/null', 'w')  # Suppress stderr
    file_path = sys.argv[1]
    text = extract_text(file_path)
    print(json.dumps({"text": text}))