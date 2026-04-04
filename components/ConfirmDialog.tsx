'use client'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  type?: 'danger' | 'warning'
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'danger'
}: ConfirmDialogProps) {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a] animate-fade-in"
      onClick={onCancel}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="flex justify-center pt-8 pb-4">
          <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          <h3 className="text-xl font-bold text-white text-center mb-3">
            {title}
          </h3>
          <p className="text-gray-500 text-center mb-6 leading-relaxed">
            {message}
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all transform active:scale-95 ${
                type === 'danger'
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-600/50'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg hover:shadow-yellow-600/50'
              }`}
            >
              {confirmText}
            </button>
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all transform active:scale-95 shadow-lg"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
