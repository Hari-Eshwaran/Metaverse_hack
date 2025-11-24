import React, { useState, useRef, useEffect } from 'react';
import { StyleProfile, GeneratedImage } from '../types';
import { generateStyledImage, fusePrompt, editImage } from '../services/geminiService';
import { Loader2, Download, Sparkles, Wand2, Paperclip, X, Upload, Layers, Sliders, Image as ImageIcon, Trash2, Plus } from 'lucide-react';
import { StyleEditor } from './StyleEditor';

interface GeneratorProps {
  styleProfile: StyleProfile;
  onImageGenerated: (img: GeneratedImage) => void;
  onReset: () => void;
  onProfileUpdate?: (updated: StyleProfile) => void;
}

type Mode = 'GENERATE' | 'EDIT';

export const Generator: React.FC<GeneratorProps> = ({ styleProfile, onImageGenerated, onReset, onProfileUpdate }) => {
  const [mode, setMode] = useState<Mode>('GENERATE');
  const [prompt, setPrompt] = useState('');
  const [intensity, setIntensity] = useState(0.8);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "16:9">("1:1");
  const [resolution, setResolution] = useState<"1K" | "2K" | "4K">("1K");
  const [showSettings, setShowSettings] = useState(false);
  
  // Attachments
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editor Modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Auto-switch mode based on attachments
  useEffect(() => {
    if (attachments.length > 0 && mode === 'GENERATE') {
      setMode('EDIT');
    } else if (attachments.length === 0 && mode === 'EDIT' && !currentImage) {
      setMode('GENERATE');
    }
  }, [attachments.length]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    const newAttachments: string[] = [];
    let errorMsg = null;

    const processFile = (file: File): Promise<void> => {
      return new Promise((resolve) => {
        if (!validTypes.includes(file.type)) {
          errorMsg = "Unsupported file type. Use JPG, PNG, or WebP.";
          resolve();
          return;
        }
        if (file.size > maxSize) {
          errorMsg = "File too large. Max 5MB.";
          resolve();
          return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            newAttachments.push(ev.target.result as string);
          }
          resolve();
        };
        reader.readAsDataURL(file);
      });
    };

    Promise.all(Array.from(files).map(processFile)).then(() => {
      if (errorMsg && newAttachments.length === 0) {
        setUploadError(errorMsg);
      } else {
        setAttachments(prev => [...prev, ...newAttachments]);
        setMode('EDIT');
      }
      setIsUploading(false);
      // Reset input so same files can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearAttachments = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAttachments([]);
  };

  const handleAction = async () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);

    try {
      if (mode === 'GENERATE') {
        // 1. Fuse Prompt (Flash Lite)
        const fused = await fusePrompt(prompt, styleProfile, intensity);
        
        // 2. Generate (Flash Image with Style Reference)
        // Pass the styleProfile.referenceImages to enable multimodal style transfer
        const base64 = await generateStyledImage(
          prompt, 
          fused, 
          styleProfile.referenceImages, // Multimodal Context
          aspectRatio, 
          resolution
        );

        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: base64,
          prompt: prompt,
          fusedPrompt: fused,
          styleId: styleProfile.id,
          timestamp: Date.now(),
          aspectRatio,
          resolution
        };
        
        setCurrentImage(newImage);
        setAttachments([base64]); // Auto-attach result for chaining
        onImageGenerated(newImage);

      } else {
        // Edit Mode (Flash Image)
        if (attachments.length === 0) return;
        
        // Pass all attachments
        const base64 = await editImage(attachments, prompt);
        
        const newImage: GeneratedImage = {
          id: crypto.randomUUID(),
          url: base64,
          prompt: `Edit: ${prompt}`,
          fusedPrompt: `Edit of ${attachments.length} image(s): ${prompt}`,
          styleId: styleProfile.id,
          timestamp: Date.now(),
          aspectRatio, // Keeps aspect ratio of source ideally
          resolution: '1K' 
        };

        setCurrentImage(newImage);
        setAttachments([base64]); // Update attachment for chain editing
        onImageGenerated(newImage);
      }
    } catch (e) {
      console.error(e);
      alert("Action failed. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-6 p-4 md:p-6 animate-fade-in overflow-hidden relative">
      
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="image/png, image/jpeg, image/webp" 
        multiple
        className="hidden" 
      />

      {/* Editor Modal */}
      {isEditorOpen && onProfileUpdate && (
          <StyleEditor 
             styleProfile={styleProfile} 
             onClose={() => setIsEditorOpen(false)}
             onUpdate={onProfileUpdate}
          />
      )}

      {/* Left Panel: Controls */}
      <div className="w-full md:w-[400px] flex-shrink-0 flex flex-col gap-6 overflow-y-auto scrollbar-hide pr-2">
        
        {/* Header & Mode Switch */}
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Studio</h2>
                <div className="flex gap-2 items-center mt-1">
                   <div className="text-xs text-zinc-400 font-medium bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                     {styleProfile.name}
                   </div>
                   <button onClick={onReset} className="text-[10px] text-zinc-500 hover:text-purple-400 transition-colors uppercase tracking-wider font-semibold">Change</button>
                </div>
              </div>
              
              <button 
                onClick={() => setIsEditorOpen(true)}
                className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                title="Tune Style"
              >
                <Sliders size={16} />
              </button>
            </div>

            <div className="bg-zinc-900/80 p-1 rounded-xl flex gap-1 border border-zinc-800 shadow-inner">
                <button 
                    onClick={() => { setMode('GENERATE'); if(attachments.length > 0) clearAttachments(); }}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${mode === 'GENERATE' ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Sparkles size={14} /> Generate
                </button>
                <button 
                    onClick={() => setMode('EDIT')}
                    className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all duration-300 ${mode === 'EDIT' ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/5' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Wand2 size={14} /> Edit
                </button>
            </div>
        </div>

        {/* Dynamic Controls */}
        <div className="flex-1 flex flex-col gap-5">
          
          {mode === 'GENERATE' ? (
             <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-5">
               {/* Intensity Slider */}
               <div className="space-y-3 bg-zinc-900/40 rounded-2xl p-5 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
                 <div className="flex justify-between items-end">
                    <label className="text-sm font-semibold text-zinc-200">Style Intensity</label>
                    <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{Math.round(intensity * 100)}%</span>
                 </div>
                 <div className="relative h-6 flex items-center">
                    <div className="absolute inset-x-0 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300" style={{width: `${intensity * 100}%`}} />
                    </div>
                    <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={intensity} 
                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    />
                    <div 
                        className="w-4 h-4 bg-white rounded-full shadow-lg absolute pointer-events-none transition-all duration-75 border-2 border-purple-500"
                        style={{left: `calc(${intensity * 100}% - 8px)`}}
                    />
                 </div>
                 <p className="text-[10px] text-zinc-500">Adjust how strongly the {styleProfile.name} style influences the output.</p>
               </div>

               {/* Advanced Settings Toggle */}
               <div>
                 <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className="flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-white transition-colors mb-3"
                 >
                    <Sliders size={12} />
                    {showSettings ? "Hide Settings" : "Advanced Settings"}
                 </button>
                 
                 {showSettings && (
                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                         <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Resolution</span>
                            <select 
                                value={resolution}
                                onChange={(e) => setResolution(e.target.value as any)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                            >
                                <option value="1K">1K • Standard</option>
                                <option value="2K">2K • High Res</option>
                                <option value="4K">4K • Ultra</option>
                            </select>
                         </div>
                         <div className="space-y-1.5">
                            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Aspect Ratio</span>
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value as any)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-xs text-white focus:border-purple-500 outline-none transition-all"
                            >
                                <option value="1:1">1:1 • Square</option>
                                <option value="3:4">3:4 • Portrait</option>
                                <option value="4:3">4:3 • Landscape</option>
                                <option value="16:9">16:9 • Wide</option>
                            </select>
                         </div>
                    </div>
                 )}
               </div>
             </div>
          ) : (
            // Edit Mode - Empty State placeholder if needed, but actions are now integrated
             <div className="animate-in fade-in slide-in-from-right-4 duration-300">
               {attachments.length === 0 && (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-video rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-zinc-600 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 group"
                    >
                        <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center group-hover:bg-zinc-700 group-hover:scale-110 transition-all">
                            <ImageIcon className="text-zinc-500 group-hover:text-zinc-300" size={24} />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-zinc-300 group-hover:text-white">Upload Reference</p>
                            <p className="text-xs text-zinc-500 mt-1">Select image(s) to edit</p>
                        </div>
                    </div>
                )}
             </div>
          )}

          {/* Prompt Area */}
          <div className="mt-auto space-y-3">
             <div className="flex justify-between items-end">
                <label className="text-sm font-semibold text-zinc-200">
                    {mode === 'GENERATE' ? 'Prompt' : 'Instructions'}
                </label>
                
                {/* Mode Indicator / Clear All */}
                {attachments.length > 0 && (
                    <button 
                        onClick={clearAttachments}
                        className="text-[10px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
                    >
                        <Trash2 size={12} /> Clear Attachments
                    </button>
                )}
             </div>
             
             <div className="relative group">
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity blur opacity-20"></div>
                 <div className="relative bg-zinc-950 border border-zinc-800 rounded-xl shadow-sm flex flex-col">
                    
                    {/* Attachment Rail */}
                    {attachments.length > 0 && (
                        <div className="p-3 pb-0 flex gap-2 overflow-x-auto scrollbar-hide">
                            {attachments.map((src, i) => (
                                <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-zinc-700 group/thumb">
                                    <img src={src} alt="attachment" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={() => removeAttachment(i)}
                                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-red-500"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-shrink-0 w-16 h-16 rounded-lg border border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    )}
                    
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAction();
                            }
                        }}
                        placeholder={mode === 'GENERATE' ? "Describe your vision..." : "E.g. Add neon lights, remove the hat..."}
                        className={`w-full bg-transparent p-4 text-sm text-white focus:outline-none resize-none placeholder:text-zinc-600 font-medium leading-relaxed ${attachments.length > 0 ? 'h-24' : 'h-32'}`}
                    />
                    
                    {/* Toolbar */}
                    <div className="bg-zinc-900/50 px-3 py-2 border-t border-zinc-800/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Attach Images"
                            >
                                <Paperclip size={16} />
                            </button>
                            {isUploading && <Loader2 size={16} className="text-zinc-500 animate-spin" />}
                            {uploadError && <span className="text-[10px] text-red-400">{uploadError}</span>}
                        </div>
                        <span className="text-[10px] text-zinc-600 font-mono">
                             {prompt.length} / 500
                         </span>
                    </div>
                 </div>
             </div>
          </div>

          <button
            onClick={handleAction}
            disabled={isProcessing || !prompt || (mode === 'EDIT' && attachments.length === 0)}
            className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all duration-200
              ${isProcessing || !prompt || (mode === 'EDIT' && attachments.length === 0)
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-white text-black hover:bg-zinc-200 hover:scale-[1.01] active:scale-[0.99] shadow-white/5'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" size={18} /> : mode === 'GENERATE' ? <Sparkles size={18} /> : <Wand2 size={18} />}
            {isProcessing ? (mode === 'GENERATE' ? "Dreaming..." : "Refining...") : (mode === 'GENERATE' ? "Generate Artwork" : "Apply Changes")}
          </button>
        </div>
      </div>

      {/* Right Panel: Canvas */}
      <div className="flex-1 bg-zinc-900/30 rounded-3xl border border-zinc-800/50 flex items-center justify-center relative overflow-hidden group/canvas backdrop-blur-sm">
        {/* Background Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '24px 24px'}}>
        </div>

        {currentImage ? (
          <>
            <img 
              src={currentImage.url} 
              alt="Generated" 
              className="max-w-full max-h-full object-contain shadow-2xl animate-in fade-in zoom-in duration-500" 
            />
            
            {/* Top Right Badges */}
            <div className="absolute top-6 right-6 flex flex-col gap-2 items-end">
                {currentImage.resolution && (
                    <div className="px-3 py-1 bg-black/60 backdrop-blur border border-white/10 rounded-full text-[10px] font-mono text-zinc-300 shadow-xl">
                        {currentImage.resolution} • {currentImage.aspectRatio}
                    </div>
                )}
            </div>

            {/* Bottom Right Actions */}
            <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover/canvas:opacity-100 transition-all translate-y-4 group-hover/canvas:translate-y-0 duration-300">
               <button 
                  onClick={() => {
                      setAttachments([currentImage.url]);
                      setMode('EDIT');
                  }} 
                  className="flex items-center gap-2 px-4 py-3 bg-zinc-800 text-white border border-zinc-700 rounded-full hover:bg-zinc-700 shadow-xl font-medium text-xs transition-transform hover:scale-105"
               >
                 <Wand2 size={16} /> Edit
               </button>
               <a 
                 href={currentImage.url} 
                 download={`palette-ai-${currentImage.id}.png`}
                 className="flex items-center gap-2 px-4 py-3 bg-white text-black rounded-full hover:bg-zinc-200 shadow-xl font-medium text-xs transition-transform hover:scale-105"
               >
                 <Download size={16} /> Save
               </a>
            </div>
            
            {/* Info Overlay */}
            <div className="absolute top-6 left-6">
                <div className="group/info relative">
                    <div className="w-8 h-8 flex items-center justify-center bg-black/60 backdrop-blur rounded-full text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-help">
                        <Layers size={14} />
                    </div>
                    <div className="absolute top-0 left-full ml-3 w-72 bg-zinc-950/95 backdrop-blur border border-zinc-800 p-4 rounded-xl text-xs text-zinc-400 opacity-0 group-hover/info:opacity-100 transition-all pointer-events-none z-20 shadow-2xl translate-x-[-10px] group-hover/info:translate-x-0">
                        <h4 className="font-bold text-zinc-200 mb-3 border-b border-zinc-800 pb-2">Generation Data</h4>
                        <div className="space-y-3">
                            <div>
                                <span className="text-zinc-500 block mb-0.5">Prompt</span>
                                <p className="text-zinc-300 leading-relaxed">{currentImage.prompt}</p>
                            </div>
                            {mode === 'GENERATE' && (
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Fused Style Prompt</span>
                                    <p className="text-zinc-300 font-mono text-[10px] leading-relaxed opacity-70">{currentImage.fusedPrompt}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          </>
        ) : (
          <div className="text-center p-10 max-w-sm mx-auto">
             <div className="w-20 h-20 bg-zinc-800/30 rounded-full mx-auto mb-6 border border-zinc-700/50 flex items-center justify-center animate-pulse relative">
                <div className="absolute inset-0 bg-purple-500/10 rounded-full blur-xl"></div>
                <Sparkles className="text-zinc-500 relative z-10" size={32} />
             </div>
             <h3 className="text-zinc-300 font-medium text-lg mb-2">The Canvas is Empty</h3>
             <p className="text-zinc-500 text-sm leading-relaxed">
                 Configure your settings on the left and describe your vision to begin creating with Gemini.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}