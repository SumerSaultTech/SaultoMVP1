import React from 'react';
import { File, Image, FileText, Archive, Video, Music, Download } from 'lucide-react';

interface FileDisplayProps {
  filenames: string[];
  variant?: 'user' | 'assistant';
}

const FileDisplay: React.FC<FileDisplayProps> = ({ filenames, variant = 'assistant' }) => {
  if (!filenames || filenames.length === 0) {
    return null;
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return <Image className="w-4 h-4" />;
    if (['mp4', 'avi', 'mov'].includes(ext)) return <Video className="w-4 h-4" />;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return <Music className="w-4 h-4" />;
    if (['pdf', 'txt', 'md', 'csv'].includes(ext)) return <FileText className="w-4 h-4" />;
    if (['zip', 'rar'].includes(ext)) return <Archive className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const getOriginalFilename = (filename: string) => {
    // Remove timestamp prefix if present (e.g., "1234567890_document.pdf" -> "document.pdf")
    const match = filename.match(/^\d+_(.+)$/);
    return match ? match[1] : filename;
  };

  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/api/uploads/${filename}`;
    link.download = getOriginalFilename(filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isUser = variant === 'user';
  
  return (
    <div className="mt-2 space-y-1">
      {filenames.map((filename, index) => (
        <div
          key={index}
          className={`flex items-center gap-2 p-2 rounded-md text-sm border ${
            isUser 
              ? 'bg-blue-500 border-blue-400' 
              : 'bg-gray-100 border-gray-200'
          }`}
        >
          <div className={isUser ? 'text-blue-100' : 'text-gray-500'}>
            {getFileIcon(filename)}
          </div>
          <div className="flex-1 min-w-0">
            <div className={`truncate font-medium ${
              isUser ? 'text-white' : 'text-gray-900'
            }`}>
              {getOriginalFilename(filename)}
            </div>
          </div>
          <button
            onClick={() => handleDownload(filename)}
            className={`p-1 rounded ${
              isUser 
                ? 'text-blue-100 hover:text-white hover:bg-blue-400' 
                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
            }`}
            title="Download file"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export { FileDisplay };