import React from 'react';
import { FolderOpen, X, Plus, Clock, FileText, Trash2, RotateCcw } from 'lucide-react';
import { DEMO_PROJECT } from '../utils/demoData';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedProjects: Array<{
    id: string;
    title: string;
    updatedAt: number;
    segmentCount: number;
  }>;
  onLoadProject: (id: string) => void;
  onNewProject: () => void;
  onLoadDemo: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  savedProjects,
  onLoadProject,
  onNewProject,
  onLoadDemo,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-purple-400" />
            <h3 className="font-bold text-sm text-white">Subtitle Projects</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-3 pb-2">
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Blank Project</span>
          </button>

          <button
            onClick={() => {
              onLoadDemo();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 font-semibold text-xs transition"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Load Quran Demo</span>
          </button>
        </div>

        {/* Projects List */}
        <div className="py-3 space-y-2 overflow-y-auto flex-1 text-xs">
          <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Saved Projects ({savedProjects.length})
          </span>

          {savedProjects.length === 0 ? (
            <div className="text-center py-8 text-neutral-500">
              No saved projects yet.
            </div>
          ) : (
            savedProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onLoadProject(p.id);
                  onClose();
                }}
                className="bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 p-3 rounded-xl cursor-pointer transition flex items-center justify-between group"
              >
                <div className="space-y-1 overflow-hidden pr-2">
                  <div className="font-semibold text-neutral-200 group-hover:text-amber-300 transition truncate">
                    {p.title}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 text-neutral-400" />
                      {p.segmentCount} segments
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-400" />
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <span className="text-[11px] text-amber-400 font-medium opacity-0 group-hover:opacity-100 transition shrink-0">
                  Open →
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
