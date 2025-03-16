import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import https from 'https';



export async function POST({ request }: RequestEvent) {
  try {
    const { text } = await request.json();
    
    if (!text) {
      return json({ error: 'No text provided' }, { status: 400 });
    }
    
    // Create a PDF document
    const pdfBuffer = await generatePDF(text);
    
    // Return the PDF as a base64 string
    return json({
      pdf: pdfBuffer.toString('base64')
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return json({ 
      error: error instanceof Error ? error.message : 'Failed to generate PDF' 
    }, { status: 500 });
  }
}

async function downloadFont(url: string, destination: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if font already exists in /tmp
    if (fs.existsSync(destination)) {
      return resolve(destination);
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Download the font
    const file = fs.createWriteStream(destination);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destination);
      });
    }).on('error', (err) => {
      fs.unlink(destination, () => {});
      reject(err);
    });
  });
}

async function generatePDF(text: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting PDF generation');
      console.log(text.length);
      // Create a PDF document (A4 size)
      const doc = new PDFDocument({
        size: 'A4', // 210mm x 297mm
        margin: 0,
        info: {
          Title: 'Chinese Composition',
          Author: 'Composition Generator'
        },
        autoFirstPage: false // We'll add the first page manually
      });
      
      const chunks: Buffer[] = [];
      
      // Collect PDF data chunks
      doc.on('data', (chunk) => chunks.push(chunk));
      
      // Resolve with the complete PDF data when done
      doc.on('end', () => {
        console.log('PDF generation completed');
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // Handle errors
      doc.on('error', (err) => {
        console.error('PDF generation error:', err);
        reject(err);
      });
      
      // Download font to /tmp directory (the only writable location in Vercel)
      const fontDestination = '/tmp/fonts/KaiTi.ttf';
      const fontUrl = 'https://github.com/Tomlord1122/helphelp-titi/blob/main/static/fonts/KaiTi.ttf'; // Host your font somewhere accessible
      
      try {
        const fontPath = await downloadFont(fontUrl, fontDestination);
        console.log('Font downloaded successfully to:', fontPath);
        doc.registerFont('Custom', fontPath);
      } catch (fontError) {
        console.warn('Failed to download font:', fontError);
        console.log('Using Helvetica as fallback font');
      }
      
      // Set up the grid parameters (in points, 1cm = 28.35pt)
      const gridWidth = 1.1 * 28.35; // 1.1cm in points
      const gridHeight = 0.95 * 28.35; // 0.95cm in points
      const rowSpacing = 0.35 * 28.35; // 0.35cm in points
      const gridsPerRow = 15;
      const maxRows = 20;
      const charsPerPage = gridsPerRow * maxRows; // 每頁最大字符數 (15x20=300)
      
      // Calculate margins to center the grid on the page
      const pageWidth = 595.28; // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const totalGridWidth = gridsPerRow * gridWidth;
      const totalGridHeight = maxRows * gridHeight + (maxRows - 1) * rowSpacing;
      const marginLeft = (pageWidth - totalGridWidth) / 2;
      const marginTop = (pageHeight - totalGridHeight) / 2;
      
      // Border line thickness
      const borderLineWidth = 1.5;
      
      console.log('Page dimensions:', pageWidth, 'x', pageHeight);
      console.log('Grid dimensions:', totalGridWidth, 'x', totalGridHeight);
      console.log('Margins:', marginLeft, 'x', marginTop);
      
      // Process the text to handle spaces and line breaks properly
      const preprocessedText = text.split('\n').map(line => {
        // Trim trailing spaces from each line
        return line.replace(/\s+$/g, '');
      }).join('\n');
      
      // Split text into characters
      const characters = preprocessedText.split('');
      console.log(`Total characters to process: ${characters.length}`);
      
      // 計算總頁數 (向上取整)
      // 需要考慮換行符的影響，所以先計算實際需要的格子數
      let totalGridsNeeded = 0;
      for (let i = 0; i < characters.length; i++) {
        if (characters[i] === '\n') {
          // 換行符：移到下一行開始
          const currentCol = totalGridsNeeded % gridsPerRow;
          if (currentCol > 0) { // 只有在不是行首時才需要跳過格子
            totalGridsNeeded += (gridsPerRow - currentCol);
          }
        } else {
          // 普通字符：佔用一個格子
          totalGridsNeeded++;
        }
      }
      const totalPages = Math.ceil(totalGridsNeeded / charsPerPage);
      console.log(`Total grids needed: ${totalGridsNeeded}, Total pages needed: ${totalPages}`);
      
      // 處理每一頁
      let globalCharIndex = 0; // 追蹤整個文本的字符位置
      
      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        // 添加新頁面
        doc.addPage();
        console.log(`Generating page ${pageNum + 1}`);
        
        // 每頁重置格子計數和位置
        let pageGridCount = 0;
        let pageChars = [];
        
        // 收集這一頁的字符
        while (globalCharIndex < characters.length && pageGridCount < charsPerPage) {
          const char = characters[globalCharIndex];
          pageChars.push(char);
          globalCharIndex++;
          
          if (char === '\n') {
            // 換行符：移到下一行開始
            const currentCol = pageGridCount % gridsPerRow;
            if (currentCol > 0) { // 只有在不是行首時才需要跳過格子
              pageGridCount += (gridsPerRow - currentCol);
            }
          } else {
            // 普通字符：佔用一個格子
            pageGridCount++;
          }
          
          // 檢查是否達到頁面限制
          if (pageGridCount >= charsPerPage) {
            break;
          }
        }
        
        // 先繪製整個網格的邊框
        doc.lineWidth(borderLineWidth);
        doc.rect(
          marginLeft - borderLineWidth/2, 
          marginTop - borderLineWidth/2, 
          totalGridWidth + borderLineWidth, 
          totalGridHeight + borderLineWidth
        ).stroke();
        
        // 恢復標準線寬
        doc.lineWidth(0.5);
        
        // 繪製所有格子 (無論是否有字符)
        for (let row = 0; row < maxRows; row++) {
          for (let col = 0; col < gridsPerRow; col++) {
            // 計算格子位置
            const x = marginLeft + col * gridWidth;
            const y = marginTop + row * (gridHeight + rowSpacing);
            
            // 繪製網格單元格
            doc.rect(x, y, gridWidth, gridHeight).stroke();
          }
        }
        
        // 跟蹤當前位置，用於放置字符
        let row = 0;
        let col = 0;
        
        // 放置字符
        for (let i = 0; i < pageChars.length; i++) {
          const char = pageChars[i];
          
          // 處理換行字符
          if (char === '\n') {
            // 只有在不是行首時才換行
            if (col > 0) {
              row++;
              col = 0;
            }
            continue;
          }
          
          // 如果到達行尾，移到下一行
          if (col >= gridsPerRow) {
            row++;
            col = 0;
          }
          
          // 檢查是否超出頁面範圍
          if (row >= maxRows) {
            console.warn(`Character at position ${i} exceeds page bounds, skipping`);
            continue;
          }
          
          // 計算字符位置
          const x = marginLeft + col * gridWidth;
          const y = marginTop + row * (gridHeight + rowSpacing);
          
          // 設置字體大小
          doc.fontSize(18);
          
          // 添加字符到格子中
          try {
            // 使用TTF格式的字體
            if (fs.existsSync(fontDestination)) {
              doc.font('Custom');
            } else {
              doc.font('Helvetica');
            }
            
            // 獲取文本尺寸以使其居中
            const textWidth = doc.widthOfString(char);
            const textHeight = doc.currentLineHeight();
            
            // 計算居中位置
            const textX = x + (gridWidth - textWidth) / 2;
            const textY = y + (gridHeight - textHeight) / 2;
            
            // 繪製文本
            doc.text(char, textX, textY, {
              align: 'left',
              lineBreak: false
            });
          } catch (textError) {
            console.error(`Error drawing character '${char}' at position ${i} on page ${pageNum + 1}:`, textError);
            
            // 如果出錯，繪製一個佔位框
            doc.font('Helvetica');
            doc.rect(x + 5, y + 5, gridWidth - 10, gridHeight - 10).stroke();
          }
          
          // 移到下一列
          col++;
        }
        
        // 添加頁碼
        doc.font('Helvetica').fontSize(10);
        doc.text(`Page ${pageNum + 1} of ${totalPages}`, pageWidth / 2, pageHeight - 20, {
          align: 'center'
        });
      }
      
      // 完成 PDF 生成
      doc.end();
      
    } catch (error) {
      console.error('Error in PDF generation:', error);
      reject(error);
    }
  });
} 