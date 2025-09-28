'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileImage, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileProcess: (files: File[]) => Promise<void>;
  isLoading: boolean;
  customPrompt: string;
}

export default function FileUploader({ onFileProcess, isLoading, customPrompt }: FileUploaderProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Reset input for re-selection
    e.target.value = '';
  };

  const handleFiles = (files: File[]) => {
    // Append new files to existing ones (de-dupe using name, size and lastModified)
    setSelectedFiles(prev => {
      const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
      const newFiles = files.filter(f => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });
      return [...prev, ...newFiles];
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (selectedFiles.length === 0) return;
    await onFileProcess(selectedFiles);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
          "hover:border-primary/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.png,.jpg,.jpeg,.webp"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Upload className="h-12 w-12 text-muted-foreground mb-4" />

          {selectedFiles.length === 0 ? (
            <>
              <h3 className="text-lg font-semibold mb-2">Drop your statements here</h3>
              <p className="text-sm text-muted-foreground mb-4">
                or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:underline font-medium"
                  type="button"
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-muted-foreground">
                Supports PNG, JPG, JPEG, WebP images
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-2">
                {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Total size: {formatFileSize(totalSize)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  + Add More
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedFiles([])}
                  type="button"
                >
                  Clear All
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Selected Files: {selectedFiles.length}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent/5 transition-colors group"
                >
                  <FileImage className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate flex-1" title={file.name}>{file.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {formatFileSize(file.size)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Process Button */}
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            size="lg"
            onClick={handleProcess}
            disabled={isLoading || selectedFiles.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Process {selectedFiles.length} {selectedFiles.length === 1 ? 'Statement' : 'Statements'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}