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
  Paper,
  Chip
} from '@mui/material';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';

interface ProcessedFile {
  file: File;
  originalSize: number;
  compressedSize: number;
  isCompressed: boolean;
  folderName: string;
}

interface FolderData {
  name: string;
  files: File[];
  processedFiles: ProcessedFile[];
}

function App() {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string[]>([]);

  const handleFolderUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(event.target.files || []);
    
    // フォルダごとにファイルをグループ化
    const folderMap = new Map<string, File[]>();
    
    uploadedFiles.forEach(file => {
      // ファイルパスからフォルダ名を取得
      const pathParts = file.webkitRelativePath.split('/');
      const folderName = pathParts[0];
      
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)?.push(file);
    });

    // フォルダデータを作成
    const newFolders: FolderData[] = Array.from(folderMap.entries()).map(([name, files]) => ({
      name,
      files,
      processedFiles: []
    }));

    setFolders(prev => [...prev, ...newFolders]);
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

  const compressImage = async (file: File, folderName: string): Promise<ProcessedFile> => {
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
          isCompressed: false,
          folderName
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
          quality -= 0.2;
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
        isCompressed: true,
        folderName
      };
    }

    return {
      file: currentFile,
      originalSize,
      compressedSize: currentFile.size,
      isCompressed: false,
      folderName
    };
  };

  const processFiles = async () => {
    setIsProcessing(true);
    setProcessingStatus([]);

    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      setProcessingStatus(prev => [...prev, `Processing folder: ${folder.name}`]);
      
      const processed: ProcessedFile[] = [];
      for (const file of folder.files) {
        setProcessingStatus(prev => [...prev, `Processing ${file.name}...`]);
        const result = await compressImage(file, folder.name);
        processed.push(result);
        setProcessingStatus(prev => [
          ...prev, 
          `Completed ${file.name} (${(result.originalSize / 1024).toFixed(2)}KB → ${(result.compressedSize / 1024).toFixed(2)}KB)`
        ]);
      }

      setFolders(prev => {
        const newFolders = [...prev];
        newFolders[i] = { ...newFolders[i], processedFiles: processed };
        return newFolders;
      });
    }

    setIsProcessing(false);
  };

  const downloadProcessedFiles = async () => {
    const zip = new JSZip();
    
    folders.forEach(folder => {
      const folderZip = zip.folder(folder.name);
      if (folderZip) {
        folder.processedFiles.forEach(({ file }) => {
          folderZip.file(file.name, file);
        });
      }
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'processed_folders.zip';
    link.click();
  };

  const removeFolder = (index: number) => {
    setFolders(prev => prev.filter((_, i) => i !== index));
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
              Select Folders
            </Button>
          </label>
        </Box>

        {folders.length > 0 && (
          <Box sx={{ my: 2 }}>
            <Typography variant="h6">Selected Folders:</Typography>
            <List>
              {folders.map((folder, index) => (
                <ListItem 
                  key={index}
                  secondaryAction={
                    <Button 
                      color="error" 
                      onClick={() => removeFolder(index)}
                    >
                      Remove
                    </Button>
                  }
                >
                  <ListItemText 
                    primary={folder.name}
                    secondary={`${folder.files.length} files`}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {folders.length > 0 && !isProcessing && !folders.some(f => f.processedFiles.length > 0) && (
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

        {folders.some(f => f.processedFiles.length > 0) && (
          <Box sx={{ my: 2 }}>
            <Typography variant="h6">Processed Files:</Typography>
            {folders.map((folder, folderIndex) => (
              <Box key={folderIndex} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                  {folder.name}
                </Typography>
                <List>
                  {folder.processedFiles.map(({ file, originalSize, compressedSize, isCompressed }, index) => (
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
              </Box>
            ))}
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
