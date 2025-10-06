import React, { useState, useEffect, useRef } from 'react';
import { ImageCollection, ImageRecord } from '../types';
import { EditIcon, PlusIcon, SparklesIcon, StarIcon, TrashIcon, XIcon } from './IconComponents';
import { GoogleGenAI, Modality } from '@google/genai';

interface CollectionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collection: Omit<ImageCollection, 'id'> & { id?: string }) => void;
  collection: ImageCollection | null;
}

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const dataUrlToParts = (dataUrl: string): { mimeType: string; data: string } | null => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2],
  };
};


export const CollectionForm: React.FC<CollectionFormProps> = ({ isOpen, onClose, onSave, collection }) => {
  const [name, setName] = useState('');
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [complexity, setComplexity] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for AI image generation
  const [showGenerator, setShowGenerator] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string; prompt: string } | null>(null);

  // State for AI image editing
  const [editingImage, setEditingImage] = useState<ImageRecord | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedImage, setEditedImage] = useState<{ url: string; prompt: string } | null>(null);

  useEffect(() => {
    if (collection) {
      setName(collection.name);
      setImages(collection.images);
      setComplexity(collection.complexity);
    } else {
      setName('');
      setImages([]);
      setComplexity(1);
    }
    // Reset AI states when form is opened/closed or collection changes
    setShowGenerator(false);
    setGenerationPrompt('');
    setIsGenerating(false);
    setGeneratedImage(null);
    setEditingImage(null);
    setEditPrompt('');
    setIsEditing(false);
    setEditedImage(null);
  }, [collection, isOpen]);
  
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // FIX: Explicitly type `file` as `File` to resolve type inference issues.
    const newImagesPromises = Array.from(files).map(async (file: File) => {
      const url = await fileToDataUrl(file);
      const defaultName = file.name.split('.').slice(0, -1).join(' ');
      return {
        id: `img-${Date.now()}-${Math.random()}`,
        url,
        names: [defaultName],
      };
    });
    
    const newImages = await Promise.all(newImagesPromises);
    setImages(prev => [...prev, ...newImages]);
  };

  const handleRemoveImage = (id: string) => {
    setImages(images.filter(img => img.id !== id));
  };
  
  const handleImageNameChange = (id: string, newNames: string) => {
    setImages(images.map(img => img.id === id ? { ...img, names: newNames.split(',').map(s => s.trim()).filter(Boolean) } : img));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === '' || images.length < 2) {
        alert("Please provide a name and at least two images.");
        return;
    }
    onSave({ id: collection?.id, name, images, complexity });
  };

  const handleGenerateImage = async () => {
    if (!generationPrompt.trim() || !process.env.API_KEY) {
        alert("Please enter a prompt and ensure your API key is configured.");
        return;
    }
    setIsGenerating(true);
    setGeneratedImage(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: `A bright, simple, and friendly cartoon for a toddler. ${generationPrompt}`,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const imageUrl = `data:image/jpeg;base64,${base64ImageBytes}`;
        setGeneratedImage({ url: imageUrl, prompt: generationPrompt });
    } catch (error) {
        console.error("Image generation failed:", error);
        alert("Sorry, we couldn't generate the image. The prompt may have been rejected. Please try a different prompt.");
    } finally {
        setIsGenerating(false);
    }
  };

  const handleAcceptImage = () => {
    if (generatedImage) {
        const newImage: ImageRecord = {
            id: `img-${Date.now()}-${Math.random()}`,
            url: generatedImage.url,
            names: [generatedImage.prompt],
        };
        setImages(prev => [...prev, newImage]);
        setGeneratedImage(null);
        setGenerationPrompt('');
    }
  };
  
  const handleStartEdit = (image: ImageRecord) => {
    setShowGenerator(false); // Close generator if open
    setEditingImage(image);
    setEditPrompt('');
    setEditedImage(null);
  };
  
  const handleCancelEdit = () => {
    setEditingImage(null);
    setEditPrompt('');
    setEditedImage(null);
  };
  
  const handleGenerateEditedImage = async () => {
    if (!editPrompt.trim() || !editingImage || !process.env.API_KEY) {
        alert("Please select an image and enter a prompt.");
        return;
    }
    setIsEditing(true);
    setEditedImage(null);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const imageParts = dataUrlToParts(editingImage.url);
        if (!imageParts) {
            throw new Error("Invalid image data URL");
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [
                    { inlineData: { data: imageParts.data, mimeType: imageParts.mimeType }},
                    { text: editPrompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (imagePart?.inlineData) {
            const base64ImageBytes = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType || imageParts.mimeType;
            const imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
            setEditedImage({ url: imageUrl, prompt: editPrompt });
        } else {
             throw new Error("No image was generated. The prompt may have been rejected.");
        }

    } catch (error) {
        console.error("Image editing failed:", error);
        alert(`Sorry, we couldn't edit the image. ${(error as Error).message}`);
    } finally {
        setIsEditing(false);
    }
  };
  
  const handleAcceptEdit = () => {
    if (editedImage && editingImage) {
        setImages(images.map(img => img.id === editingImage.id ? { ...img, url: editedImage.url } : img));
        handleCancelEdit();
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{collection ? 'Edit Collection' : 'Create New Collection'}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <XIcon className="w-6 h-6 text-gray-600"/>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <label htmlFor="collectionName" className="block text-sm font-medium text-gray-700 mb-1">Collection Name</label>
              <input type="text" id="collectionName" value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Complexity</label>
              <div className="flex space-x-1">
                {[...Array(5)].map((_, i) => (
                  <button type="button" key={i} onClick={() => setComplexity(i + 1)} className="focus:outline-none">
                    <StarIcon className={`w-8 h-8 cursor-pointer ${i < complexity ? 'text-yellow-400' : 'text-gray-300'}`} filled={i < complexity} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">Images ({images.length})</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map(image => (
                  <div key={image.id} className="relative group aspect-square border rounded-md p-1">
                    <img src={image.url} alt={image.names[0]} className="w-full h-full object-cover rounded" />
                    <div className="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col p-1 justify-end">
                      <input 
                        type="text" 
                        value={image.names.join(', ')} 
                        onChange={(e) => handleImageNameChange(image.id, e.target.value)}
                        placeholder="e.g. Dog, Puppy"
                        className="text-white bg-transparent border-b border-gray-400 text-xs w-full focus:outline-none focus:border-white mb-1"
                      />
                    </div>
                     <button type="button" onClick={() => handleStartEdit(image)} className="absolute top-0 left-0 m-1 p-1 bg-white bg-opacity-70 rounded-full text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit with AI">
                        <EditIcon className="w-4 h-4" />
                     </button>
                    <button type="button" onClick={() => handleRemoveImage(image.id)} className="absolute top-0 right-0 m-1 p-1 bg-white bg-opacity-70 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Remove image">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-gray-300 rounded-md text-gray-500 hover:bg-gray-50 hover:border-blue-500 transition-colors">
                  <PlusIcon className="w-8 h-8"/>
                  <span className="text-sm mt-1">Add Images</span>
                </button>
                <button type="button" onClick={() => { setShowGenerator(p => !p); setEditingImage(null); }} className={`flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-md transition-colors ${showGenerator ? 'border-purple-500 bg-purple-50 text-purple-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-purple-500'}`}>
                  <SparklesIcon className="w-8 h-8"/>
                  <span className="text-sm mt-1">Generate AI</span>
                </button>
                <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              </div>

              {showGenerator && (
                <div className="mt-4 p-4 border-t">
                    <h3 className="text-lg font-medium text-gray-800 mb-2">Generate Image with AI</h3>
                    <div className="flex items-start space-x-4">
                        <div className="flex-grow">
                             <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                             <div className="flex items-center space-x-2">
                                <input id="ai-prompt" type="text" value={generationPrompt} onChange={(e) => setGenerationPrompt(e.target.value)} placeholder="e.g. A happy cartoon cat" disabled={isGenerating} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"/>
                                <button type="button" onClick={handleGenerateImage} disabled={isGenerating || !generationPrompt} className="px-4 py-2 bg-purple-500 text-white rounded-md shadow hover:bg-purple-600 disabled:bg-gray-400">
                                    {isGenerating ? '...' : 'Generate'}
                                </button>
                             </div>
                        </div>
                        <div className="w-32 h-32 bg-gray-100 rounded-md flex items-center justify-center border overflow-hidden">
                           {isGenerating && <div className="text-sm text-gray-500">Generating...</div>}
                           {generatedImage && <img src={generatedImage.url} alt="Generated" className="w-full h-full object-cover" />}
                           {!isGenerating && !generatedImage && <div className="text-xs text-gray-400 text-center p-2">Preview</div>}
                        </div>
                    </div>
                    {generatedImage && !isGenerating && (
                        <div className="mt-3 flex justify-end space-x-2">
                             <button type="button" onClick={() => setGeneratedImage(null)} className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Try Again</button>
                            <button type="button" onClick={handleAcceptImage} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md shadow hover:bg-green-600">Accept Image</button>
                        </div>
                    )}
                </div>
              )}

              {editingImage && (
                 <div className="mt-4 p-4 border-t">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-medium text-gray-800">Edit Image with AI</h3>
                        <button onClick={handleCancelEdit} className="p-1 rounded-full hover:bg-gray-100"><XIcon className="w-5 h-5 text-gray-500"/></button>
                    </div>
                    <div className="flex items-start space-x-4">
                        <div className="w-32 h-32 bg-gray-100 rounded-md flex items-center justify-center border overflow-hidden flex-shrink-0">
                           <img src={editingImage.url} alt="Original" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-grow">
                             <label htmlFor="ai-edit-prompt" className="block text-sm font-medium text-gray-700 mb-1">Edit Prompt</label>
                             <div className="flex items-center space-x-2">
                                <input id="ai-edit-prompt" type="text" value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="e.g. Add a birthday hat" disabled={isEditing} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"/>
                                <button type="button" onClick={handleGenerateEditedImage} disabled={isEditing || !editPrompt} className="px-4 py-2 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600 disabled:bg-gray-400">
                                    {isEditing ? '...' : 'Generate'}
                                </button>
                             </div>
                        </div>
                        <div className="w-32 h-32 bg-gray-100 rounded-md flex items-center justify-center border overflow-hidden flex-shrink-0">
                           {isEditing && <div className="text-sm text-gray-500">Generating...</div>}
                           {editedImage && <img src={editedImage.url} alt="Edited" className="w-full h-full object-cover" />}
                           {!isEditing && !editedImage && <div className="text-xs text-gray-400 text-center p-2">Preview</div>}
                        </div>
                    </div>
                    {editedImage && !isEditing && (
                        <div className="mt-3 flex justify-end space-x-2">
                             <button type="button" onClick={() => setEditedImage(null)} className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">Try Again</button>
                            <button type="button" onClick={handleAcceptEdit} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md shadow hover:bg-green-600">Accept Edit</button>
                        </div>
                    )}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end items-center p-4 bg-gray-50 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-3">Cancel</button>
            <button type="submit" disabled={name.trim() === '' || images.length < 2} className="px-6 py-2 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed">
              Save Collection
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
