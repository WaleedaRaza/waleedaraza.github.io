"""
Simple, robust markdown to PDF converter
No ASCII art, no fancy formatting - just clean readable text
"""
import os
import re
from fpdf import FPDF

class CleanPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.add_font('Arial', '', 'C:/Windows/Fonts/arial.ttf')
        self.add_font('Arial', 'B', 'C:/Windows/Fonts/arialbd.ttf')
        self.add_font('Arial', 'I', 'C:/Windows/Fonts/ariali.ttf')
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(25, 25, 25)
        
    def header(self):
        self.set_font('Arial', 'I', 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, 'waleedaraza.github.io | System Prompts for LLM Code Editors', align='R')
        self.ln(10)
        
    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f'Page {self.page_no()}', align='C')

def strip_all_formatting(text):
    """Aggressively clean text for PDF"""
    if not text:
        return ""
    
    # Replace all special unicode
    subs = [
        ('—', '-'), ('–', '-'), ('→', '->'), ('←', '<-'), ('↓', 'v'),
        ('◈', '*'), ('▶', '>'), ('□', '[ ]'), ('✓', '[x]'), ('✗', '[ ]'),
        ('│', '|'), ('├', '|'), ('└', '|'), ('┌', '+'), ('┐', '+'),
        ('┘', '+'), ('─', '-'), ('═', '='), ('║', '|'), ('╔', '+'),
        ('╗', '+'), ('╚', '+'), ('╝', '+'), ('╭', '+'), ('╮', '+'),
        ('╰', '+'), ('╯', '+'), ('┬', '+'), ('┴', '+'), ('┼', '+'),
        ('▼', 'v'), ('▲', '^'), ('◄', '<'), ('►', '>'), ('•', '-'),
        ('"', '"'), ('"', '"'), (''', "'"), (''', "'"), ('…', '...'),
        ('≠', '!='), ('×', 'x'), ('≈', '~'), ('²', '2'),
        ('`', ''), ('**', ''), ('*', ''),
    ]
    for old, new in subs:
        text = text.replace(old, new)
    
    # Remove markdown links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    
    return text.strip()

def is_ascii_art_line(line):
    """Detect if a line is ASCII art (boxes, diagrams)"""
    art_chars = set('│├└┌┐┘─═║╔╗╚╝╭╮╰╯┬┴┼+|\\/-_')
    clean = line.strip()
    if not clean:
        return False
    # If more than 40% special chars, it's probably ASCII art
    special_count = sum(1 for c in clean if c in art_chars or c in '+-|_/\\')
    return special_count > len(clean) * 0.4

def extract_content_from_block(lines):
    """Extract readable text from a code/ascii block, skip pure art"""
    result = []
    for line in lines:
        clean = line.strip()
        # Skip empty or pure ASCII art lines
        if not clean:
            continue
        if is_ascii_art_line(clean):
            continue
        # Skip lines that are just borders
        if re.match(r'^[\+\-\|\_\=\s]+$', clean):
            continue
        # Clean and keep
        text = strip_all_formatting(clean)
        if text and len(text) > 2:
            result.append(text)
    return result

def parse_md_simple(content):
    """Parse markdown into simple elements - skip ASCII art"""
    lines = content.split('\n')
    elements = []
    in_code = False
    code_lines = []
    
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        
        # Code blocks
        if stripped.startswith('```'):
            if in_code:
                # Extract useful text from code block, skip art
                useful = extract_content_from_block(code_lines)
                for u in useful:
                    elements.append(('text', u))
                code_lines = []
                in_code = False
            else:
                in_code = True
            i += 1
            continue
        
        if in_code:
            code_lines.append(line)
            i += 1
            continue
        
        # Skip pure ASCII art lines outside code blocks too
        if is_ascii_art_line(stripped):
            i += 1
            continue
        
        # Tables - convert to bullets
        if '|' in stripped and stripped.startswith('|'):
            # Collect table rows
            while i < len(lines) and '|' in lines[i] and lines[i].strip().startswith('|'):
                row = lines[i].strip()
                if not re.match(r'^[\|\-\s:]+$', row):  # Skip separator
                    cells = [c.strip() for c in row.split('|') if c.strip()]
                    if cells:
                        text = ' | '.join(cells)
                        elements.append(('bullet', strip_all_formatting(text)))
                i += 1
            continue
        
        # Headers
        if stripped.startswith('# '):
            elements.append(('h1', strip_all_formatting(stripped[2:])))
        elif stripped.startswith('## '):
            elements.append(('h2', strip_all_formatting(stripped[3:])))
        elif stripped.startswith('### '):
            elements.append(('h3', strip_all_formatting(stripped[4:])))
        # Quote
        elif stripped.startswith('> '):
            elements.append(('quote', strip_all_formatting(stripped[2:])))
        # HR
        elif stripped in ['---', '***', '___']:
            elements.append(('hr', None))
        # List
        elif re.match(r'^[\-\*]\s', stripped):
            text = re.sub(r'^[\-\*]\s*', '', stripped)
            elements.append(('bullet', strip_all_formatting(text)))
        elif re.match(r'^\d+\.\s', stripped):
            text = re.sub(r'^\d+\.\s*', '', stripped)
            elements.append(('bullet', strip_all_formatting(text)))
        # Regular text
        elif stripped:
            elements.append(('text', strip_all_formatting(stripped)))
        
        i += 1
    
    return elements

def make_pdf(md_path, pdf_path):
    """Create clean PDF from markdown"""
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    elements = parse_md_simple(content)
    
    pdf = CleanPDF()
    pdf.add_page()
    w = pdf.w - 50  # text width
    
    for etype, econtent in elements:
        try:
            if etype == 'h1':
                pdf.ln(3)
                pdf.set_font('Arial', 'B', 18)
                pdf.set_text_color(220, 90, 40)
                pdf.multi_cell(w, 8, econtent)
                pdf.ln(3)
                
            elif etype == 'h2':
                pdf.ln(4)
                pdf.set_font('Arial', 'B', 13)
                pdf.set_text_color(0, 140, 120)
                pdf.multi_cell(w, 7, econtent)
                pdf.ln(2)
                
            elif etype == 'h3':
                pdf.ln(2)
                pdf.set_font('Arial', 'B', 11)
                pdf.set_text_color(60, 60, 60)
                pdf.multi_cell(w, 6, econtent)
                pdf.ln(1)
                
            elif etype == 'quote':
                pdf.set_font('Arial', 'I', 10)
                pdf.set_text_color(90, 90, 90)
                if econtent:
                    pdf.multi_cell(w, 5, f'  "{econtent}"')
                    pdf.ln(2)
                
            elif etype == 'bullet':
                pdf.set_font('Arial', '', 10)
                pdf.set_text_color(50, 50, 50)
                if econtent:
                    pdf.multi_cell(w, 5, f'  - {econtent}')
                    pdf.ln(1)
                
            elif etype == 'hr':
                pdf.ln(2)
                y = pdf.get_y()
                pdf.set_draw_color(180, 180, 180)
                pdf.line(25, y, pdf.w - 25, y)
                pdf.ln(2)
                
            elif etype == 'text':
                pdf.set_font('Arial', '', 10)
                pdf.set_text_color(50, 50, 50)
                if econtent:
                    pdf.multi_cell(w, 5, econtent)
                    pdf.ln(1)
                    
        except Exception as e:
            continue
    
    pdf.output(pdf_path)
    print(f'  OK: {os.path.basename(pdf_path)}')

def main():
    base = r'c:\Users\Waleed\Desktop\Site\waleedaraza-repo-fresh\writing\system-prompts'
    
    pairs = [
        ('01-philosophical-operating-system.md', '01-Philosophical-Operating-System.pdf'),
        ('02-learning-protocol.md', '02-Learning-Protocol.pdf'),
        ('03-vision-based-planning.md', '03-Vision-Based-Planning.pdf'),
        ('04-flowchart-mind.md', '04-Flowchart-Mind.pdf'),
        ('05-ninety-ten-doctrine.md', '05-Ninety-Ten-Doctrine.pdf'),
    ]
    
    print('Creating PDFs...')
    for md, pdf in pairs:
        md_path = os.path.join(base, md)
        pdf_path = os.path.join(base, pdf)
        if os.path.exists(md_path):
            make_pdf(md_path, pdf_path)
        else:
            print(f'  MISSING: {md}')
    print('Done.')

if __name__ == '__main__':
    main()
