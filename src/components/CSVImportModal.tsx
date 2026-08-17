'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface CSVImportModalProps {
  type: 'salaries' | 'payments' | 'expenses';
  onClose: () => void;
  onSuccess: () => void;
}

export default function CSVImportModal({ type, onClose, onSuccess }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [generalError, setGeneralError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template columns info to guide user
  const headersMap = {
    salaries: ['Date (YYYY-MM-DD)', 'Accounting Period (MM-YYYY)', 'Employee Name', 'Amount', 'Payment Source (COMPANY / PARTNER / CLIENT_DIRECT)', 'Paid By Partner', 'Client Name', 'Received By Partner'],
    payments: ['Date (YYYY-MM-DD)', 'Accounting Period (MM-YYYY)', 'Project Name', 'Client Name', 'Amount', 'Received By Partner'],
    expenses: ['Date (YYYY-MM-DD)', 'Accounting Period (MM-YYYY)', 'Description', 'Category', 'Amount', 'Paid By Partner'],
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrors([]);
    setGeneralError('');
    setSuccess(false);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.csv') || selectedFile.type === 'text/csv') {
        setFile(selectedFile);
      } else {
        setGeneralError('Please select a valid CSV file (.csv)');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setErrors([]);
    setGeneralError('');
    setSuccess(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.type === 'text/csv') {
        setFile(droppedFile);
      } else {
        setGeneralError('Please upload a valid CSV file (.csv)');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setGeneralError('Please select a file to import first.');
      return;
    }

    setLoading(true);
    setErrors([]);
    setGeneralError('');

    try {
      const text = await file.text();
      const res = await fetch(`/api/import?type=${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: text,
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'Validation Failed') {
          setErrors(data.details || []);
        } else {
          setGeneralError(data.error || 'Failed to import CSV file.');
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      setGeneralError('Connection error. Failed to send CSV content.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="max-w-xl w-full glass-card p-6 rounded-2xl border border-slate-800 space-y-5 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-xl font-bold text-white flex items-center">
            <Upload className="h-5 w-5 mr-2 text-cyan-400" />
            Import {type.charAt(0).toUpperCase() + type.slice(1)} CSV
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white" disabled={loading}>
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Instructions */}
        <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl text-xs space-y-2">
          <p className="font-semibold text-slate-300">CSV Header columns needed:</p>
          <div className="flex flex-wrap gap-1.5">
            {headersMap[type].map((header, idx) => (
              <span key={idx} className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                {header}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-500">
            * Note: Names must match existing records in the database case-insensitively.
          </p>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 ${
            file
              ? 'border-cyan-500/50 bg-cyan-950/5'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <Upload className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">{file.name}</p>
              <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-300">
                Drag and drop your CSV file here, or <span className="text-cyan-400 hover:underline">browse</span>
              </p>
              <p className="text-xs text-slate-500">Only .csv files accepted</p>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="overflow-y-auto max-h-[25vh] space-y-2 pr-1">
          {success && (
            <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold rounded-lg flex items-center">
              <CheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
              CSV parsed and imported successfully! Refreshing ledger...
            </div>
          )}

          {generalError && (
            <div className="p-3 bg-red-950/20 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-start">
              <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          {errors.length > 0 && (
            <div className="p-3 bg-red-950/10 border border-red-500/20 rounded-lg space-y-1.5">
              <p className="text-xs font-bold text-red-400 flex items-center">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Import validation failed:
              </p>
              <ul className="list-disc pl-4 text-[11px] text-red-200 space-y-1">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-slate-200 text-sm rounded-lg hover:bg-slate-700 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-cyan-500 text-black text-sm font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center"
            disabled={loading || !file || success}
          >
            {loading && <RefreshCw className="animate-spin h-4 w-4 mr-1.5" />}
            Upload & Import
          </button>
        </div>
      </div>
    </div>
  );
}
