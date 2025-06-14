import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, File, Image, FileText, Archive, Video, Music } from 'lucide-react';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
  disabled?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelect,
  selectedFiles,
  onRemoveFile,
  disabled = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    onFilesSelect([...selectedFiles, ...files]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();

    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    if (type.includes('pdf') || name.endsWith('.pdf')) return <FileText className="w-4 h-4" />;
    if (type.includes('zip') || type.includes('archive') || name.endsWith('.zip') || name.endsWith('.rar')) {
      return <Archive className="w-4 h-4" />;
    }
    if (type.includes('text') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv')) {
      return <FileText className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const allowedExtensions = [
    'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 
    'ppt', 'pptx', 'csv', 'json', 'zip', 'py', 'js', 'html', 'css', 'c', 
    'cpp', 'h', 'java', 'rb', 'php', 'xml', 'md'
  ];

  return (
    <div className="space-y-2">
      {/* File Upload Button */}
      <button
        type="button"
        onClick={triggerFileSelect}
        disabled={disabled}
        className="h-8 px-2 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      >
        <Paperclip className="w-4 h-4" />
      </button>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept={allowedExtensions.map(ext => `.${ext}`).join(',')}
        disabled={disabled}
      />

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm"
            >
              <div className="text-gray-500">
                {getFileIcon(file)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium text-gray-900">
                  {file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemoveFile(index)}
                className="h-6 w-6 p-0 hover:bg-red-100 rounded flex items-center justify-center"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { FileUpload };