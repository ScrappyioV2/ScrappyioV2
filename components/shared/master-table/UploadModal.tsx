'use client';

import { useState, useCallback } from 'react';
import { X, Upload, FileText } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[]) => void;
  multiple?: boolean;
}

export default function UploadModal({ 
  isOpen, onClose, onUpload, multiple = true 
}: UploadModalProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    setSelectedFiles(prev => [
      ...prev.filter(f => !newFiles.some(nf => nf.name === f.name)),
      ...newFiles
    ]);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    handleDrag(e, false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect, handleDrag]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    e.target.value = '';
  }, [handleFileSelect]);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
      setSelectedFiles([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#1a1a1a] flex items-center justify-center z-50 p-4">
      <div className="bg-[#111111] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Upload className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Upload Products</h2>
              <p className="text-sm text-gray-300">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#1a1a1a] rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div 
            className={`border-2 border-dashed p-12 rounded-xl text-center transition-all cursor-pointer hover:shadow-lg ${
              dragActive ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-200' : 'border-white/[0.1] hover:border-gray-400'
            }`}
            onDragOver={e => handleDrag(e, true)}
            onDragEnter={e => handleDrag(e, true)}
            onDragLeave={e => handleDrag(e, false)}
            onDrop={handleDrop}
          >
            <FileText className="w-16 h-16 mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {dragActive ? 'Drop files here' : `Drop ${multiple ? 'multiple ' : ''}files here`}
            </h3>
            <p className="text-sm text-gray-300 mb-6">or click to browse</p>
            <input 
              id="file-upload" 
              type="file" 
              multiple={multiple}
              accept=".csv,.xlsx,.xls" 
              onChange={handleInputChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 inline-flex items-center gap-2 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              Choose Files
            </label>
          </div>

          {selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                Selected Files ({selectedFiles.length})
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center p-3 bg-[#111111] rounded-lg gap-3">
                    <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{file.name}</p>
                      <p className="text-xs text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                    <button 
                      onClick={() => removeFile(index)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors ml-auto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t bg-[#111111] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 border border-white/[0.1] text-gray-500 rounded-lg hover:bg-[#111111] font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload}
            disabled={selectedFiles.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}





