// Process text for grid display, ensuring each line starts on a new row
export function processTextForGrid(text: string, maxLength: number = 5000): string[] {
  // First, preprocess the text to handle spaces properly
  // Limit input size to prevent stack overflow
  const truncatedText = text.slice(0, maxLength);
  const lines = truncatedText.split('\n').map(line => {
    // Trim trailing spaces from each line
    return line.replace(/\s+$/g, '');
  });
  
  const result: string[] = [];
  const rowLength = 15;
  
  // Process each line
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const chars = line.split('');
    
    // If not the first line and the previous line didn't end at a row boundary,
    // add empty cells to ensure this line starts on a new row
    if (lineIndex > 0) {
      const prevLineLength = lines[lineIndex - 1].length;
      const prevLineRowPosition = prevLineLength % rowLength;
      
      // If the previous line didn't end exactly at the end of a row,
      // add empty cells to push this line to the next row
      if (prevLineRowPosition > 0) {
        const emptyCount = rowLength - prevLineRowPosition;
        for (let i = 0; i < emptyCount; i++) {
          result.push('');
        }
      }
    }
    
    // Add the characters from this line
    result.push(...chars);
  }
  
  return result;
}

// Read file content as text
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
} 