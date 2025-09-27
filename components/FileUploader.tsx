'use client';

import { useRef, useState } from 'react';

interface FileUploaderProps {
  onFileProcess: (files: File[]) => void;
  isLoading: boolean;
  customPrompt?: string;
}

export default function FileUploader({ onFileProcess, isLoading, customPrompt }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      // Reset the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleFiles = (files: File[]) => {
    // Append new files to existing ones instead of replacing
    setSelectedFiles(prev => {
      // De-dupe using name, size and lastModified so same-named statements in different months are still accepted
      const existingKeys = new Set(prev.map(f => `${f.name}-${f.size}-${f.lastModified}`));
      const nextFiles = files.filter(f => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (existingKeys.has(key)) {
          return false;
        }
        existingKeys.add(key);
        return true;
      });
      return [...prev, ...nextFiles];
    });
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleProcess = () => {
    if (selectedFiles.length > 0) {
      onFileProcess(selectedFiles);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full">
      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleChange}
          accept=".png,.jpg,.jpeg,.webp"
          multiple
        />

        <div className="flex flex-col items-center justify-center p-8">
          <svg
            className="w-12 h-12 mb-3 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {selectedFiles.length > 0 ? (
            <div className="text-center">
              <p className="text-lg font-medium text-slate-700">
                {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Total size: {(selectedFiles.reduce((acc, file) => acc + file.size, 0) / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          ) : (
            <>
              <p className="text-base font-medium text-slate-700 mb-2">
                Drop your statements here
              </p>
              <p className="text-sm text-slate-500 mb-4">
                or{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse files
                </button>
              </p>
              <p className="text-xs text-slate-400">
                Supports PNG, JPG, JPEG, WebP images
              </p>
            </>
          )}
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4">
          {/* Files Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Selected Files: {selectedFiles.length}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 text-xs bg-white text-blue-600 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
                  type="button"
                >
                  + Add More
                </button>
                <button
                  onClick={clearAllFiles}
                  className="px-3 py-1 text-xs bg-white text-red-600 border border-red-600 rounded hover:bg-red-50 transition-colors"
                  type="button"
                >
                  Clear All
                </button>
              </div>
            </div>
            {/* Grid Layout for Files */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative p-2 bg-white rounded border border-slate-200 group hover:border-slate-300">
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-1 right-1 p-1 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="text-xs font-medium text-slate-700 truncate pr-4" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ))}
            </div>
          </div>

          {/* Process Button - Full Width */}
          <button
            onClick={handleProcess}
            disabled={isLoading}
            className="w-full px-6 py-4 bg-blue-600 text-white font-semibold text-lg rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] shadow-lg"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Process {selectedFiles.length} Statement{selectedFiles.length > 1 ? 's' : ''}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}