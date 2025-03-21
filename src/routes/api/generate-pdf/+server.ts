import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';



export async function POST({ request }: RequestEvent) {
  try {
    const { text, useIndentation = false } = await request.json();
    
    if (!text) {
      return json({ error: 'No text provided' }, { status: 400 });
    }
    
    // Create a PDF document
    // 根據是否需要縮進來選擇生成函數
    const pdfBuffer = useIndentation ? await generatePDF2(text) : await generatePDF(text);
    
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

async function generatePDF(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting PDF generation with no indentation');
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
      
      // Add alternative font paths to check
      const alternativePaths = [
        path.join(process.cwd(), 'static', 'fonts', 'KaiTi.ttf'),
        path.join(process.cwd(), 'build', 'static', 'fonts', 'KaiTi.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'KaiTi.ttf'),
        path.join("./KaiTi.ttf"),
        // For AWS Lambda or similar environments
        '/opt/fonts/KaiTi.ttf',
        '/tmp/fonts/KaiTi.ttf'
      ];
      
      // Try to find the font in any of the possible locations
      let fontFound = false;
      let usableFontPath = '';
      
      for (const testPath of alternativePaths) {
        console.log('Checking for font at:', testPath);
        if (fs.existsSync(testPath)) {
          console.log('TTF font found at:', testPath);
          usableFontPath = testPath;
          fontFound = true;
          break;
        }
      }
      
      if (fontFound) {
        console.log('TTF font found, registering...');
        doc.registerFont('Custom', usableFontPath);
      } else {
        console.warn('TTF font not found in any of the checked locations');
        console.log('Using Helvetica as fallback font, no Chinese fonts loaded');
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
      // 需要考慮換行符和空行的影響，所以先計算實際需要的格子數
      let totalGridsNeeded = 0;
      
      // 將文本分行處理
      const lines = preprocessedText.split('\n');
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        // 如果是空行，添加一整行的空格子
        if (line.trim() === '') {
          totalGridsNeeded += gridsPerRow;
        } else {
          // 非空行，添加字符數量的格子
          totalGridsNeeded += line.length;
          
          // 如果不是最後一行，且不是剛好在行尾結束，則需要添加換行的格子
          if (lineIndex < lines.length - 1) {
            const currentCol = totalGridsNeeded % gridsPerRow;
            if (currentCol > 0) {
              totalGridsNeeded += (gridsPerRow - currentCol);
            }
          }
        }
      }
      
      const totalPages = Math.ceil(totalGridsNeeded / charsPerPage);
      console.log(`Total grids needed: ${totalGridsNeeded}, Total pages needed: ${totalPages}`);
      
      // 處理每一頁
      let globalCharIndex = 0; // 追蹤整個文本的字符位置
      let currentLine = 0; // 追蹤當前處理的行
      
      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        // 添加新頁面
        doc.addPage();
        console.log(`Generating page ${pageNum + 1}`);
        
        // 每頁重置格子計數和位置
        let pageGridCount = 0;
        let pageChars = [];
        
        // 收集這一頁的字符和處理空行
        while (currentLine < lines.length && pageGridCount < charsPerPage) {
          const line = lines[currentLine];
          
          // 處理空行
          if (line.trim() === '') {
            // 添加一整行的空格子
            for (let i = 0; i < gridsPerRow; i++) {
              if (pageGridCount < charsPerPage) {
                pageChars.push(''); // 添加空字符
                pageGridCount++;
              }
            }
            currentLine++;
            continue;
          }
          
          // 處理非空行的字符
          let processedCharsInLine = 0; // 記錄此行已處理的字符數
          
          for (let i = 0; i < line.length; i++) {
            if (pageGridCount >= charsPerPage) {
              // 達到頁面限制時，記錄已處理的位置
              processedCharsInLine = i;
              break;
            }
            
            const char = line[i];
            pageChars.push(char);
            pageGridCount++;
            globalCharIndex++;
            processedCharsInLine++;
          }
          
          // 檢查是否已處理完當前行
          const hasCompletedLine = processedCharsInLine === line.length;
          
          // 如果這行沒有完全處理完（頁面已滿），不增加行指針
          if (!hasCompletedLine) {
            // 創建一個新的行，只包含未處理的部分
            lines[currentLine] = line.substring(processedCharsInLine);
            console.log(`Split line at char ${processedCharsInLine}, remaining: ${lines[currentLine].length} chars`);
            break; // 跳出循環，下一頁繼續處理
          }
          
          // 如果不是最後一行，且不是剛好在行尾結束，則需要添加換行的格子
          if (hasCompletedLine && currentLine < lines.length - 1) {
            const currentCol = pageGridCount % gridsPerRow;
            if (currentCol > 0) {
              const emptyCount = gridsPerRow - currentCol;
              for (let i = 0; i < emptyCount; i++) {
                if (pageGridCount < charsPerPage) {
                  pageChars.push(''); // 添加空字符表示換行
                  pageGridCount++;
                }
              }
            }
          }
          
          // 只有在完整處理了這一行後才增加行指針
          if (hasCompletedLine) {
            currentLine++;
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
          
          // 如果是空字符，只移動位置不繪製
          if (char === '') {
            col++;
            // 如果到達行尾，移到下一行
            if (col >= gridsPerRow) {
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
            if (fs.existsSync(usableFontPath)) {
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

async function generatePDF2(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting PDF generation with indentation');
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
        console.log('PDF generation with indentation completed');
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });
      
      // Handle errors
      doc.on('error', (err) => {
        console.error('PDF generation error:', err);
        reject(err);
      });
      
      // Add alternative font paths to check
      const alternativePaths = [
        path.join(process.cwd(), 'static', 'fonts', 'KaiTi.ttf'),
        path.join(process.cwd(), 'build', 'static', 'fonts', 'KaiTi.ttf'),
        path.join(process.cwd(), 'public', 'fonts', 'KaiTi.ttf'),
        path.join("./KaiTi.ttf"),
        // For AWS Lambda or similar environments
        '/opt/fonts/KaiTi.ttf',
        '/tmp/fonts/KaiTi.ttf'
      ];
      
      // Try to find the font in any of the possible locations
      let fontFound = false;
      let usableFontPath = '';
      
      for (const testPath of alternativePaths) {
        console.log('Checking for font at:', testPath);
        if (fs.existsSync(testPath)) {
          console.log('TTF font found at:', testPath);
          usableFontPath = testPath;
          fontFound = true;
          break;
        }
      }
      
      if (fontFound) {
        console.log('TTF font found, registering...');
        doc.registerFont('Custom', usableFontPath);
      } else {
        console.warn('TTF font not found in any of the checked locations');
        console.log('Using Helvetica as fallback font, no Chinese fonts loaded');
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
      
      // 計算總頁數 (向上取整)
      let totalGridsNeeded = 0;
      
      // 將文本分行處理
      const lines = preprocessedText.split('\n');
      let processedLines: string[] = [];
      
      // 第一行不需要添加縮進
      if (lines.length > 0) {
        processedLines.push(lines[0]);
      }
      
      // 從第二行開始，添加兩個空格作為縮進
      // 這裡修改為處理每個手動換行
      for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        const currentLine = lines[lineIndex];
        processedLines.push(currentLine); // 為每個換行後的新行添加兩個空格
      }
      
      // 將處理後的行組合回來
      const indentedText = processedLines.join('\n');
      console.log("處理縮進後的文本:", indentedText);
      
      // 重新分割文本以處理自動換行
      const chars = indentedText.split('');
      const formattedChars: string[] = [];
      let lineCharCount = 0;
      
      // 處理自動換行和縮進
      for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        
        // 如果遇到換行符，重置計數器
        if (char === '\n') {
          formattedChars.push(char);
          lineCharCount = 0;
          continue;
        }
        
        // 如果達到自動換行的條件 (15個字符)
        if (lineCharCount === gridsPerRow) {
          formattedChars.push('\n'); // 添加換行
          formattedChars.push(' '); // 添加兩個空格作為縮進
          formattedChars.push(' ');
          lineCharCount = 2; // 重置計數器，考慮已添加的兩個空格
        }
        
        formattedChars.push(char);
        lineCharCount++;
      }
      
      // 使用處理後的字符數組重新生成文本
      const finalText = formattedChars.join('');
      console.log("最終處理後的文本:", finalText);
      
      // 將文本重新分割為行進行處理
      const finalLines = finalText.split('\n');
      
      // 計算總格子數
      for (let lineIndex = 0; lineIndex < finalLines.length; lineIndex++) {
        const line = finalLines[lineIndex];
        
        // 如果是空行，添加一整行的空格子
        if (line.trim() === '') {
          totalGridsNeeded += gridsPerRow;
        } else {
          // 非空行，添加字符數量的格子
          totalGridsNeeded += line.length;
          
          // 如果不是最後一行，且不是剛好在行尾結束，則需要添加換行的格子
          if (lineIndex < finalLines.length - 1) {
            const currentCol = totalGridsNeeded % gridsPerRow;
            if (currentCol > 0) {
              totalGridsNeeded += (gridsPerRow - currentCol);
            }
          }
        }
      }
      
      const totalPages = Math.ceil(totalGridsNeeded / charsPerPage);
      console.log(`Total grids needed with indentation: ${totalGridsNeeded}, Total pages needed: ${totalPages}`);
      
      // 處理每一頁
      let globalCharIndex = 0; // 追蹤整個文本的字符位置
      let currentLine = 0; // 追蹤當前處理的行
      
      for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        // 添加新頁面
        doc.addPage();
        console.log(`Generating page ${pageNum + 1} with indentation`);
        
        // 每頁重置格子計數和位置
        let pageGridCount = 0;
        let pageChars = [];
        
        // 收集這一頁的字符和處理空行
        while (currentLine < finalLines.length && pageGridCount < charsPerPage) {
          const line = finalLines[currentLine];
          
          // 處理空行
          if (line.trim() === '') {
            // 添加一整行的空格子
            for (let i = 0; i < gridsPerRow; i++) {
              if (pageGridCount < charsPerPage) {
                pageChars.push(''); // 添加空字符
                pageGridCount++;
              }
            }
            currentLine++;
            continue;
          }
          
          // 處理非空行的字符
          let processedCharsInLine = 0; // 記錄此行已處理的字符數
          
          for (let i = 0; i < line.length; i++) {
            if (pageGridCount >= charsPerPage) {
              // 達到頁面限制時，記錄已處理的位置
              processedCharsInLine = i;
              break;
            }
            
            const char = line[i];
            pageChars.push(char);
            pageGridCount++;
            globalCharIndex++;
            processedCharsInLine++;
          }
          
          // 檢查是否已處理完當前行
          const hasCompletedLine = processedCharsInLine === line.length;
          
          // 如果這行沒有完全處理完（頁面已滿），不增加行指針
          if (!hasCompletedLine) {
            // 創建一個新的行，只包含未處理的部分
            finalLines[currentLine] = line.substring(processedCharsInLine);
            console.log(`Split line at char ${processedCharsInLine}, remaining: ${finalLines[currentLine].length} chars`);
            break; // 跳出循環，下一頁繼續處理
          }
          
          // 如果不是最後一行，且不是剛好在行尾結束，則需要添加換行的格子
          if (hasCompletedLine && currentLine < finalLines.length - 1) {
            const currentCol = pageGridCount % gridsPerRow;
            if (currentCol > 0) {
              const emptyCount = gridsPerRow - currentCol;
              for (let i = 0; i < emptyCount; i++) {
                if (pageGridCount < charsPerPage) {
                  pageChars.push(''); // 添加空字符表示換行
                  pageGridCount++;
                }
              }
            }
          }
          
          // 只有在完整處理了這一行後才增加行指針
          if (hasCompletedLine) {
            currentLine++;
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
          
          // 如果是空字符，只移動位置不繪製
          if (char === '') {
            col++;
            // 如果到達行尾，移到下一行
            if (col >= gridsPerRow) {
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
            if (fs.existsSync(usableFontPath)) {
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
      console.error('Error in PDF generation with indentation:', error);
      reject(error);
    }
  });
}


