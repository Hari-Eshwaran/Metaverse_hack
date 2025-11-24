import React, { useState } from 'react';
import { StyleUploader } from './components/StyleUploader';
import { Generator } from './components/Generator';
import { StyleProfile, GeneratedImage, StyleAnalysisResponse } from './types';
import { LayoutGrid, Plus } from 'lucide-react';

export default function App() {
  const [activeProfile, setActiveProfile] = useState<StyleProfile | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [showGallery, setShowGallery] = useState(false);

  const handleStyleAnalyzed = (analysis: StyleAnalysisResponse, images: string[]) => {
    const newProfile: StyleProfile = {
      id: crypto.randomUUID(),
      name: analysis.suggestedName,
      description: analysis.artisticStyle,
      visualTechnique: analysis.visualTechnique,
      palette: analysis.colorPalette,
      moods: analysis.moodKeywords,
      referenceImages: images,
      createdAt: Date.now(),
      embedding: analysis.embedding,
      reasoning: analysis.reasoning,
      version: 1,
      history: []
    };
    setActiveProfile(newProfile);
    setShowGallery(false);
  };

  const handleImageGenerated = (img: GeneratedImage) => {
    setGeneratedImages(prev => [img, ...prev]);
  };

  const handleProfileUpdate = (updatedProfile: StyleProfile) => {
    setActiveProfile(updatedProfile);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-purple-500/30">
      
      {/* Header */}
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/80 backdrop-blur z-40 fixed top-0 w-full">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-md shadow-lg shadow-purple-500/20"></div>
          <span className="font-bold text-lg tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">PaletteAI</span>
        </div>
        
        <div className="flex items-center gap-4">
          {activeProfile && (
            <button 
              onClick={() => setShowGallery(!showGallery)}
              className={`p-2 rounded-lg transition-colors ${showGallery ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
              title="Toggle Gallery"
            >
              <LayoutGrid size={20} />
            </button>
          )}
          {activeProfile && (
             <button
               onClick={() => { setActiveProfile(null); setShowGallery(false); }}
               className="flex items-center gap-1 text-sm bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded-full transition-colors border border-zinc-700/50"
             >
               <Plus size={14} /> New Style
             </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 flex overflow-hidden h-screen">
        {showGallery ? (
           <div className="w-full p-6 overflow-y-auto animate-fade-in">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Gallery</h2>
                <span className="text-zinc-500 text-sm">{generatedImages.length} creations</span>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {generatedImages.length === 0 ? (
                  <div className="col-span-full py-20 text-center">
                    <div className="inline-block p-4 rounded-full bg-zinc-900 mb-4">
                        <LayoutGrid className="text-zinc-600" size={32} />
                    </div>
                    <p className="text-zinc-500">No masterpieces yet.</p>
                  </div>
                ) : (
                  generatedImages.map(img => (
                    <div key={img.id} className="group relative rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 aspect-square cursor-pointer hover:border-purple-500/50 transition-colors">
                      <img src={img.url} alt={img.prompt} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <p className="text-xs text-white line-clamp-2 font-medium">{img.prompt}</p>
                        <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-wider">{img.aspectRatio} • {new Date(img.timestamp).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
             </div>
           </div>
        ) : (
          <div className="w-full h-full relative">
            {!activeProfile ? (
              <div className="max-w-4xl mx-auto h-full flex flex-col justify-center px-6">
                <StyleUploader onStyleAnalyzed={handleStyleAnalyzed} />
              </div>
            ) : (
              <Generator 
                styleProfile={activeProfile} 
                onImageGenerated={handleImageGenerated}
                onReset={() => setActiveProfile(null)}
                onProfileUpdate={handleProfileUpdate}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}