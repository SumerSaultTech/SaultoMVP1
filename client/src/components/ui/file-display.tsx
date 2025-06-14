import React from 'react';
import { File, Image, FileText, Archive, Video, Music, Download } from 'lucide-react';

interface FileDisplayProps {
  filenames: string[];
}

const FileDisplay: React.FC<FileDisplayProps> = ({ filenames }) => {
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

  return (
    <div className="mt-2 space-y-1">
      {filenames.map((filename, index) => (
        <div
          key={index}
          className="flex items-center gap-2 p-2 bg-gray-100 rounded-md text-sm border"
        >
          <div className="text-gray-500">
            {getFileIcon(filename)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-gray-900 font-medium">
              {getOriginalFilename(filename)}
            </div>
          </div>
          <button
            onClick={() => handleDownload(filename)}
            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
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