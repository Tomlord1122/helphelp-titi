// Helper function to convert base64 to Blob
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: mimeType });
}

// Generate and download PDF with timeout
export async function generatePDF(fileContent: string, fileName: string | null): Promise<{ success: string } | { error: string }> {
  if (!fileContent) {
    return { error: 'Please upload a text file first'  };
  }
  
  // Add a timeout to the fetch request
  const timeout = 30000; // 30 seconds
  
  // Create an AbortController to handle timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log("Starting PDF generation request with content length:", fileContent.length);
    
    // Prepare content for submission
    // Limit content to 300 characters 
    console.log(`Using ${fileContent.length} characters for PDF generation`);
    
    // Call our API endpoint to generate the PDF
    const response = await fetch('/api/generate-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: fileContent }),
      signal: controller.signal
    });
    
    // Clear the timeout as we've received a response
    clearTimeout(timeoutId);
    
    console.log("Response received:", response.status, response.statusText);
    
    if (!response.ok) {
      let errorMessage = 'Failed to generate PDF';
      try {
        const errorData = await response.json();
        console.error("Error data:", errorData);
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        console.error("Failed to parse error response:", e);
        // If the response is not JSON, use the status text
        errorMessage = `${response.status}: ${response.statusText}` || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    let data;
    try {
      const responseText = await response.text();
      console.log("Response text length:", responseText.length);
      
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.log("First 100 chars of response:", responseText.substring(0, 100));
        throw new Error('Invalid JSON response from server');
      }
    } catch (e) {
      console.error("Failed to read response:", e);
      throw new Error('Invalid response from server');
    }
    
    if (!data || !data.pdf) {
      console.error("No PDF data in response:", data);
      throw new Error('No PDF data received from server');
    }
    
    // Convert base64 to blob
    console.log("PDF data length:", data.pdf.length);
    const pdfBlob = base64ToBlob(data.pdf, 'application/pdf');
    const url = URL.createObjectURL(pdfBlob);
    
    // Create a download link
    const a = document.createElement('a');
    a.href = url;
    if (fileName) {
      a.download = fileName.replace(/\.txt$/i, '.pdf') || 'composition.pdf';
    } else {
      a.download = 'composition.pdf';
    }
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    return { success: 'PDF generated successfully!' };
  } catch (err: unknown) {
    // Clear the timeout if there was an error
    clearTimeout(timeoutId);
    
    console.error('PDF generation error:', err);
    
    // Handle AbortError (timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { error: 'PDF generation timed out. Please try again with a smaller text.' };
    }
    
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return { error: 'Error generating PDF: ' + errorMessage };
  }
} 