import React, { useState } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Button, 
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Paper
} from '@mui/material';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';

interface ProcessedFile {
  file: File;
  originalSize: number;
  compressedSize: number;
  isCompressed: boolean;
}

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string[]>([]);

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    setFiles(uploadedFiles);
    setProcessedFiles([]);
    setProcessingStatus([]);
  };

  const convertPngToJpg = async (file: File): Promise<File> => {
    if (file.type !== 'image/png') {
      return file;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const newFile = new File([blob], file.name.replace('.png', '.jpg'), {
              type: 'image/jpeg'
            });
            resolve(newFile);
          } else {
            resolve(file);
          }
        }, 'image/jpeg', 0.9);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const compressImage = async (file: File): Promise<ProcessedFile> => {
    const originalSize = file.size;
    let currentFile = file;

    // PNGをJPGに変換
    if (file.type === 'image/png') {
      currentFile = await convertPngToJpg(file);
    }

    // 画像ファイルの場合のみ圧縮
    if (currentFile.type.startsWith('image/')) {
      if (currentFile.size <= 500 * 1024) {
        return {
          file: currentFile,
          originalSize,
          compressedSize: currentFile.size,
          isCompressed: false
        };
      }

      let quality = 0.9;
      let compressedFile = currentFile;
      let attempts = 0;
      const maxAttempts = 5;

      while (compressedFile.size > 500 * 1024 && attempts < maxAttempts) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          quality: quality
        };

        try {
          compressedFile = await imageCompression(currentFile, options);
          quality -= 0.2; // 品質を下げて再試行
          attempts++;
        } catch (error) {
          console.error('Error compressing image:', error);
          break;
        }
      }

      return {
        file: compressedFile,
        originalSize,
        compressedSize: compressedFile.size,
        isCompressed: true
      };
    }

    // 画像以外のファイルはそのまま返す
    return {
      file: currentFile,
      originalSize,
      compressedSize: currentFile.size,
      isCompressed: false
    };
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setProcessingStatus([]);
    const processed: ProcessedFile[] = [];

    for (const file of files) {
      setProcessingStatus(prev => [...prev, `Processing ${file.name}...`]);
      const result = await compressImage(file);
      processed.push(result);
      setProcessingStatus(prev => [
        ...prev, 
        `Completed ${file.name} (${(result.originalSize / 1024).toFixed(2)}KB → ${(result.compressedSize / 1024).toFixed(2)}KB)`
      ]);
    }

    setProcessedFiles(processed);
    setIsProcessing(false);
  };

  const downloadProcessedFiles = async () => {
    const zip = new JSZip();
    
    processedFiles.forEach(({ file }) => {
      zip.file(file.name, file);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'processed_files.zip';
    link.click();
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          File Processor
        </Typography>
        
        <Box sx={{ my: 2 }}>
          <input
            type="file"
            multiple
            // @ts-ignore
            webkitdirectory="true"
            // @ts-ignore
            directory="true"
            onChange={handleFolderUpload}
            style={{ display: 'none' }}
            id="folder-upload"
          />
          <label htmlFor="folder-upload">
            <Button variant="contained" component="span">
              Select Folder
            </Button>
          </label>
        </Box>

        {files.length > 0 && (
          <Box sx={{ my: 2 }}>
            <Typography variant="h6">Selected Files:</Typography>
            <List>
              {files.map((file, index) => (
                <ListItem key={index}>
                  <ListItemText 
                    primary={file.name}
                    secondary={`${(file.size / 1024).toFixed(2)} KB`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {files.length > 0 && !isProcessing && !processedFiles.length && (
          <Button 
            variant="contained" 
            color="primary" 
            onClick={processFiles}
            sx={{ my: 2 }}
          >
            Process Files
          </Button>
        )}

        {isProcessing && (
          <Box sx={{ my: 2 }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ mt: 1 }}>
              Processing files...
            </Typography>
          </Box>
        )}

        {processingStatus.length > 0 && (
          <Paper sx={{ p: 2, my: 2, maxHeight: 200, overflow: 'auto' }}>
            {processingStatus.map((status, index) => (
              <Typography key={index} variant="body2">
                {status}
              </Typography>
            ))}
          </Paper>
        )}

        {processedFiles.length > 0 && (
          <Box sx={{ my: 2 }}>
            <Typography variant="h6">Processed Files:</Typography>
            <List>
              {processedFiles.map(({ file, originalSize, compressedSize, isCompressed }, index) => (
                <ListItem key={index}>
                  <ListItemText 
                    primary={file.name}
                    secondary={
                      isCompressed 
                        ? `Compressed: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB`
                        : `Size: ${(compressedSize / 1024).toFixed(2)}KB`
                    }
                  />
                </ListItem>
              ))}
            </List>
            <Button 
              variant="contained" 
              color="success" 
              onClick={downloadProcessedFiles}
              sx={{ mt: 2 }}
            >
              Download Processed Files
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
}

export default App;
