
import re

def check_div_balance(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    opens = len(re.findall(r'<div', content))
    closes = len(re.findall(r'</div', content))
    
    print(f"Total <div: {opens}")
    print(f"Total </div: {closes}")
    print(f"Difference: {opens - closes}")

if __name__ == "__main__":
    check_div_balance(r"c:\Users\david\OneDrive\Documents\FLOW\FLOW 0.5.41\SYSTEM\templates\operator.html")
