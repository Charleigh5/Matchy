
import React, { useState, useEffect, useMemo } from 'react';
import { ParentDashboard } from './components/ParentDashboard';
import { GameScreen } from './components/GameScreen';
import { GameStatus, ImageCollection } from './types';
import { CollectionForm } from './components/CollectionForm';

const App: React.FC = () => {
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [selectedCollection, setSelectedCollection] = useState<ImageCollection | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<ImageCollection | null>(null);

  // Mock data is now a fallback if nothing is in localStorage
  const mockCollections: ImageCollection[] = useMemo(() => [
    {
      id: 'collection-1',
      name: 'High-Contrast Shapes',
      complexity: 1,
      images: [
        { id: 'img-1a', url: 'https://picsum.photos/seed/circle_bw/400?grayscale', names: ['Circle'] },
        { id: 'img-1b', url: 'https://picsum.photos/seed/square_bw/400?grayscale', names: ['Square'] },
        { id: 'img-1c', url: 'https://picsum.photos/seed/star_bw/400?grayscale', names: ['Star'] },
        { id: 'img-1d', url: 'https://picsum.photos/seed/heart_bw/400?grayscale', names: ['Heart'] },
      ],
    },
    {
      id: 'collection-2',
      name: 'Friendly Animal Faces',
      complexity: 1,
      images: [
        { id: 'img-2a', url: 'https://picsum.photos/seed/cartooncat/400', names: ['Cat', 'Kitty'] },
        { id: 'img-2b', url: 'https://picsum.photos/seed/cartoondog/400', names: ['Dog', 'Puppy'] },
        { id: 'img-2c', url: 'https://picsum.photos/seed/cartoonbear/400', names: ['Bear'] },
        { id: 'img-2d', url: 'https://picsum.photos/seed/cartoonbunny/400', names: ['Bunny', 'Rabbit'] },
      ],
    },
     {
      id: 'collection-3',
      name: 'Colorful Animals',
      complexity: 2,
      images: [
        { id: 'img-3a', url: 'https://picsum.photos/seed/lion/400', names: ['Lion'] },
        { id: 'img-3b', url: 'https://picsum.photos/seed/frog/400', names: ['Frog'] },
        { id: 'img-3c', url: 'https://picsum.photos/seed/duck/400', names: ['Duck'] },
        { id: 'img-3d', url: 'https://picsum.photos/seed/pig/400', names: ['Pig'] },
      ],
    },
    {
      id: 'collection-4',
      name: 'Family Faces',
      complexity: 3,
      images: [
        { id: 'img-4a', url: 'https://picsum.photos/seed/mom/400', names: ['Mommy', 'Mom'] },
        { id: 'img-4b', url: 'https://picsum.photos/seed/dad/400', names: ['Daddy', 'Dad'] },
        { id: 'img-4c', url: 'https://picsum.photos/seed/grandma/400', names: ['Grandma', 'Nana'] },
        { id: 'img-4d', url: 'https://picsum.photos/seed/grandpa/400', names: ['Grandpa'] },
      ],
    },
  ], []);
  
  const [collections, setCollections] = useState<ImageCollection[]>([]);

  // Load collections from localStorage on initial render
  useEffect(() => {
    try {
      const storedCollections = localStorage.getItem('cogniplay-collections');
      if (storedCollections) {
        setCollections(JSON.parse(storedCollections));
      } else {
        setCollections(mockCollections); // Fallback to mocks if nothing is stored
      }
    } catch (error) {
      console.error("Failed to load collections from localStorage", error);
      setCollections(mockCollections);
    }
  }, [mockCollections]);

  // Save collections to localStorage whenever they change
  useEffect(() => {
    try {
      if (collections.length > 0) {
        localStorage.setItem('cogniplay-collections', JSON.stringify(collections));
      }
    } catch (error) {
      console.error("Failed to save collections to localStorage", error);
    }
  }, [collections]);


  const handleStartGame = (collection: ImageCollection) => {
    if (collection.images.length < 2) {
      alert("Please add at least two images to a collection to start a game.");
      return;
    }
    setSelectedCollection(collection);
    setGameStatus(GameStatus.LOADING);
  };

  const handleEndGame = () => {
    setSelectedCollection(null);
    setGameStatus(GameStatus.IDLE);
  };

  const handleOpenForm = (collection: ImageCollection | null) => {
    setEditingCollection(collection);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingCollection(null);
    setIsFormOpen(false);
  };

  const handleSaveCollection = (collectionToSave: Omit<ImageCollection, 'id'> & { id?: string }) => {
    if (collectionToSave.id) {
      // Editing an existing collection
      setCollections(collections.map(c => c.id === collectionToSave.id ? { ...c, ...collectionToSave } as ImageCollection : c));
    } else {
      // Creating a new collection
      const newCollection: ImageCollection = {
        ...collectionToSave,
        id: `collection-${Date.now()}-${Math.random()}`,
      };
      setCollections(prev => [...prev, newCollection]);
    }
    handleCloseForm();
  };
  
  const handleDeleteCollection = (collectionId: string) => {
    if (window.confirm('Are you sure you want to delete this collection? This cannot be undone.')) {
      setCollections(collections.filter(c => c.id !== collectionId));
    }
  };

  const renderContent = () => {
    if (gameStatus !== GameStatus.IDLE && selectedCollection) {
      return (
        <GameScreen
          collection={selectedCollection}
          onEndGame={handleEndGame}
          gameStatus={gameStatus}
          setGameStatus={setGameStatus}
        />
      );
    } else {
      return (
        <ParentDashboard
          collections={collections}
          onStartGame={handleStartGame}
          onNewCollection={() => handleOpenForm(null)}
          onEditCollection={(collection) => handleOpenForm(collection)}
          onDeleteCollection={handleDeleteCollection}
        />
      );
    }
  };

  return (
    <div className="min-h-screen bg-blue-50 font-sans">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <h1 className="text-2xl font-bold text-gray-800">CogniPlay AI</h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6">
        {renderContent()}
      </main>
      <CollectionForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveCollection}
        collection={editingCollection}
      />
    </div>
  );
};

export default App;
