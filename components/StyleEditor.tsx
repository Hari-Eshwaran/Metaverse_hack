import React, { useState } from 'react';
import { StyleProfile, StyleSnapshot } from '../types';
import { X, Save, RotateCcw, History } from 'lucide-react';

interface StyleEditorProps {
  styleProfile: StyleProfile;
  onClose: () => void;
  onUpdate: (profile: StyleProfile) => void;
}

export const StyleEditor: React.FC<StyleEditorProps> = ({ styleProfile, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'edit' | 'history'>('edit');
  
  // Edit State
  const [name, setName] = useState(styleProfile.name);
  const [description, setDescription] = useState(styleProfile.description);
  const [technique, setTechnique] = useState(styleProfile.visualTechnique);
  const [palette, setPalette] = useState([...styleProfile.palette]);
  const [moods, setMoods] = useState([...styleProfile.moods]);
  const [moodInput, setMoodInput] = useState('');

  const handleSave = () => {
    const snapshot: StyleSnapshot = {
      version: styleProfile.version,
      timestamp: Date.now(),
      changeLog: `Updated parameters manually`,
      data: {
        name: styleProfile.name,
        description: styleProfile.description,
        visualTechnique: styleProfile.visualTechnique,
        palette: styleProfile.palette,
        moods: styleProfile.moods,
        referenceImages: styleProfile.referenceImages,
        embedding: styleProfile.embedding,
        reasoning: styleProfile.reasoning
      }
    };

    const updatedProfile: StyleProfile = {
      ...styleProfile,
      version: styleProfile.version + 1,
      history: [snapshot, ...styleProfile.history],
      name,
      description,
      visualTechnique: technique,
      palette,
      moods
    };

    onUpdate(updatedProfile);
    onClose();
  };

  const handleRevert = (snapshot: StyleSnapshot) => {
     // Create a snapshot of CURRENT state before reverting
     const currentSnapshot: StyleSnapshot = {
        version: styleProfile.version,
        timestamp: Date.now(),
        changeLog: `Reverted to v${snapshot.version}`,
        data: {
            name: styleProfile.name,
            description: styleProfile.description,
            visualTechnique: styleProfile.visualTechnique,
            palette: styleProfile.palette,
            moods: styleProfile.moods,
            referenceImages: styleProfile.referenceImages,
            embedding: styleProfile.embedding,
            reasoning: styleProfile.reasoning
        }
     };

     const revertedProfile: StyleProfile = {
         ...styleProfile,
         version: styleProfile.version + 1,
         history: [currentSnapshot, ...styleProfile.history],
         ...snapshot.data
     };
     
     onUpdate(revertedProfile);
     onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900 z-10">
                <h2 className="text-xl font-bold text-white">Tune Style Profile</h2>
                <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-800 px-6 bg-zinc-900/50">
                <button 
                    onClick={() => setActiveTab('edit')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'edit' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    Edit Parameters
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history' ? 'border-purple-500 text-purple-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}
                >
                    Version History ({styleProfile.version})
                </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-zinc-900/30">
                {activeTab === 'edit' ? (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Style Name</label>
                            <input 
                                value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-purple-500 outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Visual Technique</label>
                            <input 
                                value={technique} onChange={e => setTechnique(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-purple-500 outline-none focus:ring-1 focus:ring-purple-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Description</label>
                            <textarea 
                                value={description} onChange={e => setDescription(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-white focus:border-purple-500 outline-none h-24 resize-none focus:ring-1 focus:ring-purple-500/50 transition-all"
                            />
                        </div>

                        {/* Palette Editor */}
                        <div className="space-y-2">
                             <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Color Palette</label>
                             <div className="flex flex-wrap gap-2">
                                {palette.map((color, idx) => (
                                    <div key={idx} className="group relative w-12 h-12 rounded-lg overflow-hidden border border-zinc-700 cursor-pointer shadow-md hover:scale-105 transition-transform">
                                        <input 
                                            type="color" 
                                            value={color}
                                            onChange={(e) => {
                                                const newPalette = [...palette];
                                                newPalette[idx] = e.target.value;
                                                setPalette(newPalette);
                                            }}
                                            className="absolute -inset-4 w-20 h-20 cursor-pointer p-0"
                                        />
                                    </div>
                                ))}
                             </div>
                        </div>

                        {/* Moods Editor */}
                         <div className="space-y-2">
                             <label className="text-xs font-bold uppercase text-zinc-500 tracking-wider">Mood Tags</label>
                             <div className="flex flex-wrap gap-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800 min-h-[3rem]">
                                {moods.map((mood, idx) => (
                                    <span key={idx} className="bg-zinc-800 text-zinc-200 text-xs px-2 py-1 rounded-md flex items-center gap-1 group border border-zinc-700">
                                        {mood}
                                        <button onClick={() => setMoods(moods.filter((_, i) => i !== idx))} className="hover:text-red-400 transition-colors"><X size={12}/></button>
                                    </span>
                                ))}
                                <input 
                                    value={moodInput}
                                    onChange={e => setMoodInput(e.target.value)}
                                    onKeyDown={e => {
                                        if(e.key === 'Enter' && moodInput.trim()) {
                                            setMoods([...moods, moodInput.trim()]);
                                            setMoodInput('');
                                        }
                                    }}
                                    placeholder="+ add mood"
                                    className="bg-transparent text-xs text-white outline-none w-24 placeholder:text-zinc-600"
                                />
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {styleProfile.history.length === 0 ? (
                            <div className="text-center text-zinc-500 py-10 flex flex-col items-center">
                                <History className="w-12 h-12 mb-2 opacity-50"/>
                                <p>No history yet. Make some changes!</p>
                            </div>
                        ) : (
                            styleProfile.history.map((snapshot, idx) => (
                                <div key={idx} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-purple-400 font-bold font-mono text-sm bg-purple-500/10 px-1.5 rounded">v{snapshot.version}</span>
                                            <span className="text-zinc-600 text-xs">{new Date(snapshot.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-zinc-400 text-sm">{snapshot.changeLog}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleRevert(snapshot)}
                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-medium transition-all text-zinc-300 hover:text-white"
                                    >
                                        <RotateCcw size={14}/> Revert
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            {activeTab === 'edit' && (
                <div className="p-6 border-t border-zinc-800 bg-zinc-900 z-10">
                    <button 
                        onClick={handleSave}
                        className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-white/10 active:scale-[0.99]"
                    >
                        <Save size={18}/> Save Changes (v{styleProfile.version + 1})
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};